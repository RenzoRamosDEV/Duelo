"""La nota de git dentro del workflow: una activity `archive_reviews` por run, después de las
reviews, cuyo resultado nunca cambia el de la revisión; y las historias anteriores al parche
`archive-reviews` siguen reproduciéndose con el código actual."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import async_sessionmaker
from temporalio.api.enums.v1 import EventType
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Replayer, Worker

from duelo.adapters.agents.fake import FakeAgent
from duelo.application.ports import ArchiveOutcome
from duelo.application.task_queues import AGENTS_TASK_QUEUE, PLATFORM_TASK_QUEUE
from duelo.workflows.dto import ReviewChangeInput
from duelo.workflows.review_change import ReviewChangeWorkflow
from tests.integration.helpers import make_activities, persist_change, reviews_for
from tests.integration.workflows.legacy_review_change_before_notes import (
    ReviewChangeWorkflowBeforeNotes,
)

AGENTS = ["agent_1", "agent_2"]


class FakeArchive:
    def __init__(self, status: str = "pushed", detail: str = "") -> None:
        self.calls: list[tuple[str, str, str]] = []
        self._outcome = ArchiveOutcome(status, detail)

    async def archive(self, repo_path: str, sha: str, note: str) -> ArchiveOutcome:
        self.calls.append((repo_path, sha, note))
        return self._outcome


class FakePaths:
    async def path_of(self, project_id: UUID) -> str | None:
        return "/repo"


def _workers(env: WorkflowEnvironment, session_factory: async_sessionmaker, archive: FakeArchive):
    activities = make_activities(
        session_factory,
        {name: FakeAgent(name) for name in AGENTS},
        archive=archive,
        project_paths=FakePaths(),
        clock=lambda: datetime(2026, 10, 11, tzinfo=UTC),
    )
    return (
        Worker(env.client, task_queue=PLATFORM_TASK_QUEUE, workflows=[ReviewChangeWorkflow]),
        Worker(
            env.client,
            task_queue=AGENTS_TASK_QUEUE,
            activities=[
                activities.run_review,
                activities.record_review_infrastructure_failure,
                activities.archive_reviews,
            ],
        ),
    )


async def test_the_note_is_archived_once_per_run_after_both_reviews(
    temporal_env: WorkflowEnvironment, session_factory: async_sessionmaker
) -> None:
    change = await persist_change(session_factory, head_sha="d" * 40)
    archive = FakeArchive()
    workflow_id = f"archive-{uuid4()}"

    platform, agents = _workers(temporal_env, session_factory, archive)

    async with platform, agents:
        results = await temporal_env.client.execute_workflow(
            ReviewChangeWorkflow.run,
            ReviewChangeInput(change_id=str(change.id), agent_names=AGENTS, run=1),
            id=workflow_id,
            task_queue=PLATFORM_TASK_QUEUE,
        )
        history = await temporal_env.client.get_workflow_handle(workflow_id).fetch_history()

    assert [r.status for r in results] == ["completed", "completed"]
    [(repo_path, sha, note_text)] = archive.calls
    assert (repo_path, sha) == ("/repo", "d" * 40)
    note = json.loads(note_text)
    assert sorted(r["agent"] for r in note["reviews"]) == AGENTS
    assert all(r["status"] == "completed" for r in note["reviews"])
    # La nota es la última activity de la historia: va después de las dos reviews.
    scheduled = [
        e.activity_task_scheduled_event_attributes.activity_type.name
        for e in history.events
        if e.event_type == EventType.EVENT_TYPE_ACTIVITY_TASK_SCHEDULED
    ]
    assert scheduled == ["run_review", "run_review", "archive_reviews"]
    assert len(await reviews_for(session_factory, change)) == 2


async def test_a_failed_archive_leaves_the_review_completed(
    temporal_env: WorkflowEnvironment, session_factory: async_sessionmaker
) -> None:
    change = await persist_change(session_factory, head_sha="e" * 40)
    archive = FakeArchive("failed", "el push falló")
    platform, agents = _workers(temporal_env, session_factory, archive)

    async with platform, agents:
        results = await temporal_env.client.execute_workflow(
            ReviewChangeWorkflow.run,
            ReviewChangeInput(change_id=str(change.id), agent_names=AGENTS, run=1),
            id=f"archive-failed-{uuid4()}",
            task_queue=PLATFORM_TASK_QUEUE,
        )

    assert [r.status for r in results] == ["completed", "completed"]
    assert len(archive.calls) == 1


async def test_a_history_recorded_before_the_notes_patch_still_replays(
    temporal_env: WorkflowEnvironment, session_factory: async_sessionmaker
) -> None:
    change = await persist_change(session_factory, head_sha="f" * 40)
    activities = make_activities(session_factory, {name: FakeAgent(name) for name in AGENTS})
    workflow_id = f"before-notes-{uuid4()}"

    async with (
        Worker(
            temporal_env.client,
            task_queue=PLATFORM_TASK_QUEUE,
            workflows=[ReviewChangeWorkflowBeforeNotes],
        ),
        Worker(
            temporal_env.client,
            task_queue=AGENTS_TASK_QUEUE,
            activities=[activities.run_review, activities.record_review_infrastructure_failure],
        ),
    ):
        await temporal_env.client.execute_workflow(
            "ReviewChangeWorkflow",
            ReviewChangeInput(change_id=str(change.id), agent_names=AGENTS, run=1),
            id=workflow_id,
            task_queue=PLATFORM_TASK_QUEUE,
        )
        history = await temporal_env.client.get_workflow_handle(workflow_id).fetch_history()

    # Sin el marcador `archive-reviews` el código nuevo no programa la nota: mismo historial.
    await Replayer(workflows=[ReviewChangeWorkflow]).replay_workflow(history)
