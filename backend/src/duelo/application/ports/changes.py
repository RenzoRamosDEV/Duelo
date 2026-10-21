"""Puertos de los changes: su repositorio y la lectura del outbox."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from duelo.application.read_models import (
    ChangeCursor,
    ChangeSummary,
    RevertRef,
    StoredEvent,
)
from duelo.domain.change import Change, ChangeKind
from duelo.domain.events import ChangeCreated, ReviewReused
from duelo.domain.review import Review
from duelo.domain.review_status import ChangeReviewStatus


@dataclass(frozen=True, slots=True)
class CommitWithReviews:
    """Un commit y las reviews de su `run` actual: lo que una PR idéntica puede aprovechar."""

    change: Change
    reviews: tuple[Review, ...]


class ChangeRepository(Protocol):
    async def add(
        self,
        change: Change,
        event: ChangeCreated,
        reused: Sequence[tuple[Review, ReviewReused]] = (),
    ) -> Change:
        """Persiste `change`, `event` y, en la MISMA transacción, las reviews `reused` (cada una
        con su evento). Si `change` es un commit que revierte a otro que ya existe en el proyecto
        (`reverts_sha`), añade también el evento `commit.reverted` del original.

        Si ya existía un `Change` con la misma identidad natural
        (project_id, kind, head_sha), lo devuelve sin crear un segundo evento ni copiar reviews; su
        `id` es el del existente, distinto del de `change`, y así se distingue una reingesta.
        Una review que ya existiera (mismo change, agente y run) no se duplica ni repite su evento.
        """
        ...

    async def find_commit_with_reviews(
        self, project_id: UUID, head_sha: str
    ) -> CommitWithReviews | None:
        """El change de tipo `commit` de ese proyecto y SHA con las reviews de su `run` actual, o
        `None` si no existe."""
        ...

    async def has_reused_reviews(self, change_id: UUID) -> bool:
        """`True` si el change tiene alguna review de su `run` 1 copiada de otro change."""
        ...

    async def get(self, change_id: UUID) -> Change | None:
        """Devuelve el `Change` con ese id, o `None` si no existe."""
        ...

    async def registered_heads(
        self, project_id: UUID, kind: ChangeKind, head_shas: Sequence[str]
    ) -> frozenset[str]:
        """Los `head_shas` que ya son un change de tipo `kind` del proyecto, en una sola
        consulta (ninguna si la lista está vacía)."""
        ...

    async def live_reverter(self, project_id: UUID, head_sha: str) -> RevertRef | None:
        """El commit de revert más reciente que sigue en la rama (no deshecho) y apunta a
        `head_sha` (`Change.reverts_sha`) en ese proyecto, o `None` si no hay ninguno.

        Un revert que se deshace (`reset`, `amend`) deja de contar: el original vuelve a estar
        activo. Y como el dato vive en el commit de revert, no importa el orden de llegada."""
        ...

    async def list_for_project(
        self,
        project_id: UUID,
        *,
        kind: ChangeKind | None,
        status: frozenset[ChangeReviewStatus] | None,
        q: str | None,
        expected_agents: int,
        limit: int,
        after: ChangeCursor | None,
    ) -> list[ChangeSummary]:
        """Devuelve a lo sumo `limit` changes del proyecto, del más reciente al más antiguo
        (orden por (created_at, id) descendente), posteriores a `after` si se indica. Filtra por
        `kind`, por `review_status` (cualquiera de los indicados, calculado frente a
        `expected_agents`) y por `q` (subcadena sin distinguir mayúsculas en título, autor, SHA o
        ref; sus comodines son texto literal) cuando se indican. No incluye el diff."""
        ...

    async def advance_run(
        self, change_id: UUID, *, from_run: int, started_at: datetime, expected_agents: int
    ) -> Change | None:
        """Compare-and-swap: pasa `run` de `from_run` a `from_run + 1`, guarda `started_at` como
        inicio del nuevo `run` y `expected_agents` como sus reviews esperadas, y devuelve el
        change actualizado, o `None` si `run` ya no era `from_run` (otro reintento llegó antes)
        o el change no existe."""
        ...


class ChangeEventRepository(Protocol):
    async def list_for_change(self, project_id: UUID, change_id: UUID) -> list[StoredEvent]:
        """Devuelve los eventos del outbox cuyo payload pertenece a `change_id`, por orden
        cronológico (`created_at`; el `id` desempata). El payload es crudo: filtrarlo es cosa del
        caso de uso."""
        ...
