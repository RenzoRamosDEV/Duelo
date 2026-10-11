"""Guarda la nota de una review con el `git` del sistema: `refs/notes/duelo` en el repositorio local
del proyecto y, si se pide, empujada a `origin`. Corre en el worker `agents`, en la máquina del
usuario, con la credencial de git que el usuario ya tenga (nunca interactiva)."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from duelo.adapters.subprocess_runner import (
    CommandNotFound,
    CommandResult,
    CommandTimeout,
    run_command,
)
from duelo.application.ports import ArchiveOutcome
from duelo.application.review_notes import NOTES_REF

WRITTEN = "written"
PUSHED = "pushed"
SKIPPED = "skipped"
FAILED = "failed"

REMOTE = "origin"
# Sin credencial no interactiva el push falla rápido en vez de quedarse esperando una contraseña.
_GIT_ENV = {"GIT_TERMINAL_PROMPT": "0", "GIT_SSH_COMMAND": "ssh -o BatchMode=yes"}
_GIT_TIMEOUT = 20.0
_PUSH_TIMEOUT = 60.0


class GitNotesArchive:
    def __init__(self, *, push: bool) -> None:
        self._push = push

    async def archive(self, repo_path: str, sha: str, note: str) -> ArchiveOutcome:
        try:
            return await self._archive(repo_path, sha, note)
        except CommandNotFound:
            return ArchiveOutcome(FAILED, "git no está instalado")
        except CommandTimeout:
            return ArchiveOutcome(FAILED, "git no respondió a tiempo")

    async def _archive(self, repo_path: str, sha: str, note: str) -> ArchiveOutcome:
        exists = await _git(repo_path, "cat-file", "-e", f"{sha}^{{commit}}")
        if exists.returncode != 0:
            return ArchiveOutcome(SKIPPED, "el commit no está en el repositorio local")
        with tempfile.TemporaryDirectory(prefix="duelo-note-") as directory:
            path = Path(directory) / "note.json"
            _write_private(path, note)
            written = await _git(
                repo_path, "notes", f"--ref={NOTES_REF}", "add", "-f", "-F", str(path), sha
            )
        if written.returncode != 0:
            return ArchiveOutcome(FAILED, "git notes no pudo escribir la nota")
        if not self._push:
            return ArchiveOutcome(WRITTEN, "")
        remote = await _git(repo_path, "config", "--get", f"remote.{REMOTE}.url")
        if remote.returncode != 0 or not remote.stdout.strip():
            return ArchiveOutcome(WRITTEN, f"sin remoto {REMOTE}: la nota queda en local")
        refspec = f"refs/notes/{NOTES_REF}:refs/notes/{NOTES_REF}"
        pushed = await _git(repo_path, "push", REMOTE, refspec, timeout=_PUSH_TIMEOUT)
        if pushed.returncode != 0:
            return ArchiveOutcome(
                FAILED, f"el push de refs/notes/{NOTES_REF} falló; la nota queda en local"
            )
        return ArchiveOutcome(PUSHED, "")


async def _git(repo_path: str, *args: str, timeout: float = _GIT_TIMEOUT) -> CommandResult:
    return await run_command(["git", "-C", repo_path, *args], timeout=timeout, env=_GIT_ENV)


def _write_private(path: Path, content: str) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(content)
