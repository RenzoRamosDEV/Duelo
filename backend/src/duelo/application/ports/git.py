"""Puertos sobre el repositorio git local: inspección, hooks, historial y marcas de commits."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from duelo.domain.commit_state import Reachability, TrackedCommit


class InvalidRepository(Exception):
    """La ruta no es la raíz de un repositorio git utilizable (el mensaje es para el usuario)."""


class HookInstallError(Exception):
    """No se pudieron instalar o quitar los hooks (el mensaje es para el usuario)."""


@dataclass(frozen=True, slots=True)
class RepoInfo:
    """Lo que hace falta saber de una carpeta para darla de alta como proyecto."""

    root: str
    # URL del remoto `origin`, o `None` si el repo no lo tiene.
    remote_url: str | None


class GitRepository(Protocol):
    async def inspect(self, path: str) -> RepoInfo:
        """Comprueba que `path` es la raíz de un repo git (ruta absoluta, sin `..`, sin NUL, que
        no sea un enlace simbólico) y devuelve su raíz y su remoto `origin`. Lanza
        `InvalidRepository` en cualquier otro caso."""
        ...


class HookInstaller(Protocol):
    async def install(self, root: str, *, slug: str) -> None:
        """Instala los hooks `post-commit` y `pre-push` en el repo de `root` para el proyecto
        `slug`, sin tocar el contenido previo de esos hooks. Idempotente. Lanza `HookInstallError`
        sin haber modificado nada si no es posible (hook que no es de shell, `core.hooksPath`
        fuera del repo...)."""
        ...

    async def uninstall(self, root: str) -> None:
        """Quita los bloques de Duelo de los hooks de `root`, dejando intacto el resto. Si la
        carpeta ya no existe no hace nada."""
        ...


class HistoryUnavailable(Exception):
    """No se pudo consultar el historial del repositorio (carpeta movida o borrada, git ausente o
    sin respuesta...). Quien barre no debe marcar nada de ese proyecto."""


class RepositoryHistory(Protocol):
    async def reachable(self, path: str, *, limit: int) -> Reachability:
        """Los commits alcanzables desde todas las referencias y desde `HEAD` del repo de `path`
        (como mucho `limit`, los más recientes), con la fecha del más antiguo. Lanza
        `HistoryUnavailable` si no se puede consultar."""
        ...

    async def contains(self, path: str, sha: str) -> bool:
        """`True` si `sha` es alcanzable desde alguna referencia o desde `HEAD`. Un SHA que no sea
        hexadecimal nunca llega a git y da `False`. Lanza `HistoryUnavailable`."""
        ...


class CommitMarks(Protocol):
    async def tracked_commits(self, project_id: UUID, *, limit: int) -> list[TrackedCommit]:
        """Los changes de tipo `commit` del proyecto (como mucho `limit`, los de creación más
        reciente, con desempate por id), con lo que el barrido necesita saber."""
        ...

    async def apply(
        self,
        project_id: UUID,
        *,
        discard: Sequence[UUID],
        restore: Sequence[UUID],
        at: datetime,
    ) -> tuple[int, int]:
        """Marca como deshechos los changes de `discard` (con `discarded_at = at`) y desmarca los
        de `restore`, con su evento cada uno, en una transacción. Solo toca los que cambian de
        estado, así que es idempotente. Devuelve cuántos se marcaron y cuántos se desmarcaron."""
        ...
