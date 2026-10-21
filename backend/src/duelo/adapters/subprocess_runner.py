"""Ejecuta programas externos (git, gh, CLI de agentes) sin shell, con plazo y la salida acotada."""

from __future__ import annotations

import asyncio
import contextlib
import os
import signal
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from typing import cast

MAX_OUTPUT_BYTES = 8_000_000
CHUNK_BYTES = 65_536
# Tras matar el grupo de procesos se espera como mucho esto a que se cierren sus pipes. Un
# descendiente en otra sesión (`start_new_session=True`) que heredó el stdout sobrevive al
# `killpg` y los mantiene abiertos: sin este plazo, la llamada esperaría a que él terminara.
KILL_GRACE_SECONDS = 2.0


class CommandTimeout(Exception):
    """El programa no terminó en el plazo y se mató."""


class CommandNotFound(Exception):
    """El ejecutable no existe o no se puede ejecutar."""


@dataclass(frozen=True, slots=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str
    # Verdadero si stdout o stderr superaron `max_output_bytes` y se recortaron: quien interprete
    # la salida no debe darla por completa.
    truncated: bool = False


def _kill_group(process: asyncio.subprocess.Process) -> None:
    with contextlib.suppress(ProcessLookupError):
        os.killpg(process.pid, signal.SIGKILL)


async def _read_bounded(stream: asyncio.StreamReader, max_bytes: int) -> bytes:
    """Lee `stream` hasta el final conservando como mucho `max_bytes + 1` bytes; el resto se
    descarta. El byte de más delata que la salida se recortó. No se deja de leer: un programa
    con la tubería llena se bloquearía en lugar de terminar."""
    kept = bytearray()
    while chunk := await stream.read(CHUNK_BYTES):
        room = max_bytes + 1 - len(kept)
        if room > 0:
            kept += chunk[:room]
    return bytes(kept)


async def _feed(stdin: asyncio.StreamWriter, data: bytes) -> None:
    """Entrega `data` y cierra stdin. Un programa que sale sin leerla no es un error."""
    with contextlib.suppress(BrokenPipeError, ConnectionResetError):
        stdin.write(data)
        await stdin.drain()
    stdin.close()


async def _collect(
    process: asyncio.subprocess.Process, data: bytes | None, max_bytes: int
) -> tuple[bytes, bytes]:
    """Como `Process.communicate`, pero sin retener más de `max_bytes + 1` bytes de cada salida."""
    # `run_command` crea siempre las tuberías de salida, y la de entrada cuando hay `data`.
    readers = (
        _read_bounded(cast(asyncio.StreamReader, process.stdout), max_bytes),
        _read_bounded(cast(asyncio.StreamReader, process.stderr), max_bytes),
    )
    if data is None:
        stdout, stderr = await asyncio.gather(*readers)
    else:
        stdin = cast(asyncio.StreamWriter, process.stdin)
        stdout, stderr, _ = await asyncio.gather(*readers, _feed(stdin, data))
    await process.wait()
    return stdout, stderr


async def _reap_after_kill(
    process: asyncio.subprocess.Process, collection: asyncio.Future[tuple[bytes, bytes]]
) -> None:
    """Recoge lo que quede tras matar el grupo, sin esperar más de `KILL_GRACE_SECONDS`.

    Si los pipes siguen abiertos por un descendiente desasociado, abandona la espera y los libera:
    ese descendiente sigue vivo (no hay forma fiable de localizarlo desde aquí), pero la llamada ya
    no queda colgada."""
    done, _ = await asyncio.wait({collection}, timeout=KILL_GRACE_SECONDS)
    if collection in done:
        if not collection.cancelled():
            collection.exception()  # se consume: nadie va a leer el resultado
        return
    collection.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await collection
    # No hay API pública para cerrar los pipes de un `Process`; el transporte los libera.
    transport = getattr(process, "_transport", None)
    if transport is not None:
        with contextlib.suppress(Exception):
            transport.close()
    with contextlib.suppress(Exception):
        await asyncio.wait_for(process.wait(), timeout=KILL_GRACE_SECONDS)


async def run_command(
    argv: Sequence[str],
    *,
    cwd: str | None = None,
    timeout: float = 10.0,
    env: Mapping[str, str] | None = None,
    input: str | None = None,  # noqa: A002 - mismo nombre que `subprocess.run`
    exclude_env: Collection[str] = (),
    max_output_bytes: int = MAX_OUTPUT_BYTES,
) -> CommandResult:
    """Lanza `argv` (lista, nunca shell). Lanza `CommandNotFound` o `CommandTimeout`.

    `GIT_TERMINAL_PROMPT=0` evita que git se quede esperando credenciales; `LC_ALL=C` fija el
    idioma de los mensajes de error. `input` se entrega por la entrada estándar (sin él, queda
    cerrada y nada espera datos): sirve para pasar textos grandes o sensibles sin ponerlos en los
    argumentos, que tienen límite de tamaño y se ven en la lista de procesos. `exclude_env` quita
    del entorno heredado esas variables (p. ej. secretos); `env` las puede volver a poner. Si la
    salida supera `max_output_bytes` se recorta y el resultado lleva `truncated`: lo que pasa del
    límite se descarta según llega (la memoria queda acotada) y el programa sigue hasta terminar o
    hasta el plazo, con su código de salida real."""
    inherited = {k: v for k, v in os.environ.items() if k not in set(exclude_env)}
    child_env = {**inherited, "GIT_TERMINAL_PROMPT": "0", "LC_ALL": "C", **(env or {})}
    try:
        process = await asyncio.create_subprocess_exec(
            *argv,
            cwd=cwd,
            env=child_env,
            stdin=asyncio.subprocess.DEVNULL if input is None else asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            # Grupo propio: al vencer el plazo se mata también a los hijos del programa.
            start_new_session=True,
        )
    except (FileNotFoundError, PermissionError, NotADirectoryError) as exc:
        raise CommandNotFound(argv[0]) from exc
    collection = asyncio.ensure_future(
        _collect(process, None if input is None else input.encode("utf-8"), max_output_bytes)
    )
    try:
        # `shield`: al vencer el plazo la espera se corta pero la recogida sigue, para poder
        # recoger lo que quede (con su propio plazo) después de matar el grupo.
        stdout, stderr = await asyncio.wait_for(asyncio.shield(collection), timeout=timeout)
    except TimeoutError as exc:
        _kill_group(process)
        await _reap_after_kill(process, collection)
        raise CommandTimeout(argv[0]) from exc
    except asyncio.CancelledError:
        # Quien llamó canceló (p. ej. la activity): no se deja el programa corriendo huérfano y se
        # recoge igual que al vencer el plazo (espera acotada y pipes liberados). `shield`: una
        # segunda cancelación no corta la recolección a medias; la cancelación se propaga igual.
        _kill_group(process)
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.shield(_reap_after_kill(process, collection))
        raise
    return CommandResult(
        returncode=process.returncode if process.returncode is not None else -1,
        stdout=stdout[:max_output_bytes].decode("utf-8", errors="replace"),
        stderr=stderr[:max_output_bytes].decode("utf-8", errors="replace"),
        truncated=len(stdout) > max_output_bytes or len(stderr) > max_output_bytes,
    )
