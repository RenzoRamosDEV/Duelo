from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from uuid import UUID

from duelo.application.ports import ChangeRepository, ProjectAgents, ReviewRepository, ReviewStarter
from duelo.application.project_agents import expected_agents_for, expected_agents_of
from duelo.domain.change import Change
from duelo.domain.review import ReviewStatus
from duelo.domain.review_status import (
    RETRYABLE_STATUSES,
    ChangeReviewStatus,
    review_status_from_counts,
)


class ChangeNotFound(Exception):
    def __init__(self, change_id: UUID) -> None:
        super().__init__(f"Change inexistente: {change_id}")
        self.change_id = change_id


class RetryNotAllowed(Exception):
    """El estado de la review actual no admite reintento (pendiente, en curso o completada)."""

    def __init__(self, status: ChangeReviewStatus) -> None:
        super().__init__(f"No se puede reintentar una review en estado {status.value}")
        self.status = status


async def retry_review(
    changes: ChangeRepository,
    reviews: ReviewRepository,
    starter: ReviewStarter,
    change_id: UUID,
    *,
    expected_agents: int,
    now: datetime,
    project_agents: ProjectAgents | None = None,
) -> Change:
    """Lanza una nueva ejecución (`run + 1`) para un change cuya review actual terminó con fallos.

    `now` es el inicio del nuevo `run` (reinicia el reloj de `stale`). Se arranca primero y se
    avanza `run` después: el id del workflow es determinista por run, así que dos reintentos
    simultáneos arrancan una sola ejecución, y si el arranque falla `run` no cambia y se puede
    volver a intentar (al revés, el change quedaría en un run sin reviews)."""
    change = await changes.get(change_id)
    if change is None:
        raise ChangeNotFound(change_id)

    counts = await reviews.status_counts(change_id, change.run)
    status = review_status_from_counts(
        completed=counts.get(ReviewStatus.COMPLETED, 0),
        failed=counts.get(ReviewStatus.FAILED, 0),
        expected_agents=await expected_agents_of(change, project_agents, expected_agents),
    )
    if status not in RETRYABLE_STATUSES:
        raise RetryNotAllowed(status)

    # El run nuevo espera a los agentes que elige el starter: la selección actual.
    next_expected = await expected_agents_for(project_agents, change.project_id, expected_agents)
    await starter.start(replace(change, run=change.run + 1))

    advanced = await changes.advance_run(
        change_id, from_run=change.run, started_at=now, expected_agents=next_expected
    )
    if advanced is not None:
        return advanced
    # Otro reintento avanzó `run` antes: la ejecución ya está arrancada; se devuelve el actual.
    current = await changes.get(change_id)
    if current is None:
        raise ChangeNotFound(change_id)
    return current
