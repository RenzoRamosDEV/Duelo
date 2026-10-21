"""El único punto por el que los adaptadores invocan `git` sobre la carpeta de un proyecto.

Un repositorio ajeno (o uno al que se sustituyó la carpeta) no debe poder ejecutar nada ni
cambiar la configuración con la que se lee: sin configuración de sistema, sin `fsmonitor` ni
ganchos, y sin variables que redirijan git a otro directorio. No captura nada: cada adaptador
traduce `CommandNotFound`/`CommandTimeout` a su propio error.
"""

from __future__ import annotations

import os
from collections.abc import Mapping

from duelo.adapters.subprocess_runner import CommandResult, run_command

_REDIRECTING_ENV = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR")


async def run_git(
    path: str,
    *args: str,
    timeout: float = 10.0,
    env: Mapping[str, str] | None = None,
    isolate_user_config: bool = True,
    disable_hooks: bool = True,
) -> CommandResult:
    """`git -C path args...` blindado. `isolate_user_config=False` conserva el `~/.gitconfig`
    (identidad y credenciales del usuario, o un `core.hooksPath` global que hay que ver);
    `disable_hooks=False` deja leer `core.hooksPath` tal cual. `env` se suma al blindaje."""
    options = ["-c", "core.fsmonitor=false"]
    if disable_hooks:
        options += ["-c", f"core.hooksPath={os.devnull}"]
    hardened_env = {"GIT_CONFIG_NOSYSTEM": "1"}
    if isolate_user_config:
        hardened_env["GIT_CONFIG_GLOBAL"] = os.devnull
    return await run_command(
        ["git", *options, "-C", path, *args],
        timeout=timeout,
        env={**hardened_env, **(env or {})},
        exclude_env=_REDIRECTING_ENV,
    )
