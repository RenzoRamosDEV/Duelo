"""Puertos de las reviews: el agente que revisa, el repositorio y la nota de git."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from duelo.application.read_models import (
    AgentStats,
)
from duelo.domain.change import Change
from duelo.domain.events import ReviewCompleted, ReviewFailed
from duelo.domain.review import Review, ReviewResult, ReviewStatus


class ReviewAgent(Protocol):
    name: str

    async def review(self, change: Change) -> ReviewResult:
        """Revisa `change` y devuelve su resultado. Puede lanzar una excepción si
        la review falla - el caller decide cómo registrar ese fallo."""
        ...


@dataclass(frozen=True, slots=True)
class ArchiveOutcome:
    """Qué pasó al guardar la nota: `written` (en local), `pushed` (y en el remoto), `skipped`
    (no procedía: sin carpeta, sin el commit, sin remoto) o `failed` (git o el push fallaron).
    `detail` es un motivo corto sin rutas ni salida de comandos."""

    status: str
    detail: str = ""


class UnsafeArchiveTarget(Exception):
    """El SHA del change no es un hexadecimal válido como argumento de git: la nota no se
    escribe y no tiene sentido reintentarlo."""


class ReviewArchive(Protocol):
    async def archive(self, repo_path: str, sha: str, note: str) -> ArchiveOutcome:
        """Guarda `note` como nota de git del commit `sha` en el repositorio `repo_path` y, si
        procede, la empuja al remoto. Nunca lanza por un fallo de git: lo devuelve como
        `failed`/`skipped` con su motivo. Lanza `UnsafeArchiveTarget`, sin invocar git, si `sha`
        no es un SHA seguro."""
        ...


class ReviewRepository(Protocol):
    async def add(self, review: Review, event: ReviewCompleted | ReviewFailed) -> Review:
        """Persiste `review` y `event` en una única transacción.

        Si ya existía una `Review` con la misma identidad natural
        (change_id, agent, run), la devuelve sin crear un segundo evento.
        """
        ...

    async def list_for_change(self, change_id: UUID) -> list[Review]:
        """Devuelve las reviews del change (completadas y fallidas) por fecha de creación, sin su
        salida cruda (`raw_output` es `None`): solo `get` la lee."""
        ...

    async def status_counts(self, change_id: UUID, run: int) -> dict[ReviewStatus, int]:
        """Cuántas reviews del `run` del change hay en cada estado (los estados sin ninguna no
        aparecen), con una única consulta agregada."""
        ...

    async def get(self, review_id: UUID) -> Review | None:
        """Devuelve la review con ese id (con su `raw_output`), o `None` si no existe."""
        ...

    async def agent_stats(self, *, project_id: UUID | None) -> list[AgentStats]:
        """Métricas agregadas por agente, ordenadas por nombre, de todas las reviews o solo de
        las de los changes de `project_id`. Las medias ignoran los valores nulos y son `None`
        si no hay ninguno."""
        ...
