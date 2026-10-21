"""Puerto de GitHub (`gh`): las PRs abiertas de un repositorio."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class GithubUnavailable(Exception):
    """`gh` no está instalado, no ha iniciado sesión o no devolvió una respuesta válida."""


@dataclass(frozen=True, slots=True)
class PullRequestInfo:
    number: int
    title: str
    author: str
    ref: str
    head_sha: str
    url: str


class GithubPrSource(Protocol):
    async def open_prs(self, root: str) -> list[PullRequestInfo]:
        """PRs abiertas del repo de `root` (sin diff). Lanza `GithubUnavailable` si no se pueden
        consultar."""
        ...

    async def pr_diff(self, root: str, number: int) -> str:
        """El diff de la PR `number` del repo de `root` (recortado al límite del adaptador).
        Lanza `GithubUnavailable` si no se puede consultar."""
        ...
