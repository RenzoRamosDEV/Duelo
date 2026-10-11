"""Los workers de `just worker` funcionan contra el servidor REAL de Temporal.

El servidor de test (time-skipping) no valida las opciones del `Worker` ni de `@workflow.defn`
como el real: en 2026-10-10 `versioning_behavior` sin deployment pasó toda la suite y el servidor
1.26.2 rechazó cada activación («deployment must be set…»), con lo que ningún workflow task se
completaba y las reviews se quedaron «revisando…» (ver `docs/postmortems/`, 2026-10-10).
Aquí los mismos workers que arranca `worker.py` revisan un commit de punta a punta en el servidor
de desarrollo real (`temporal server start-dev`): si el servidor rechaza una opción, el workflow
agota su plazo y el test falla.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker
from temporalio.client import WorkflowFailureError
from temporalio.testing import WorkflowEnvironment

from duelo.application.review_requests import ReviewCommitInput
from duelo.application.task_queues import PLATFORM_TASK_QUEUE
from duelo.config import WorkerSettings
from duelo.worker import build_workers
from duelo.workflows.review_commit import ReviewCommitWorkflow
from tests.integration.helpers import persist_change, reviews_for

TEST_AGENTS = ["agent_1", "agent_2"]
# Un workflow task rechazado por el servidor vence cada 10 s sin dejar rastro en la historia; con
# este plazo el fallo se ve en menos de un minuto y en verde el test dura ~2 s.
DEADLINE = timedelta(seconds=45)


async def test_the_real_workers_review_a_commit_on_the_real_temporal_server(
    local_temporal_env: WorkflowEnvironment,
    database_url: str,
    session_factory: async_sessionmaker,
) -> None:
    change = await persist_change(session_factory, head_sha="e" * 40)
    settings = WorkerSettings(database_url=database_url, agent_names=TEST_AGENTS)  # type: ignore[arg-type]
    platform, agents = build_workers(local_temporal_env.client, settings)

    async with platform, agents:
        try:
            results = await local_temporal_env.client.execute_workflow(
                ReviewCommitWorkflow.run,
                ReviewCommitInput(change_id=str(change.id), agent_names=TEST_AGENTS),
                id=f"real-server-{change.id}",
                task_queue=PLATFORM_TASK_QUEUE,
                execution_timeout=DEADLINE,
            )
        except WorkflowFailureError as exc:  # pragma: no cover - solo al fallar
            pytest.fail(
                f"El servidor real no completó la review en {DEADLINE.total_seconds():.0f} s "
                f"({exc.cause!r}). Si no hay otro motivo, el servidor rechaza una opción del "
                "Worker o de @workflow.defn: busca «Error while completing workflow activation» "
                "en el log del worker (docs/adr/0007)."
            )

    assert sorted(r.status for r in results) == ["completed", "completed"]
    stored = await reviews_for(session_factory, change)
    assert sorted((r.agent, r.status) for r in stored) == [
        ("agent_1", "completed"),
        ("agent_2", "completed"),
    ]
