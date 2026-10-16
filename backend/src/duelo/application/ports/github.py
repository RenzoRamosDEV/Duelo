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
    diff: str


class GithubPrSource(Protocol):
    async def open_prs(self, root: str) -> list[PullRequestInfo]:
        """PRs abiertas del repo de `root` (con su diff). Lanza `GithubUnavailable` si no se
        pueden consultar."""
        ...
