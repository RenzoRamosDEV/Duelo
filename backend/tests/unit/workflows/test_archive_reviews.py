"""`archive_reviews` sin Temporal: decide si hay nota, con qué contenido, y nunca lanza por git."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from temporalio.exceptions import ApplicationError

from duelo.application.ingest_change import ingest_change
from duelo.application.ports import ArchiveOutcome
from duelo.application.record_review import record_review_failure, record_review_success
from duelo.domain.change import Change, ChangeKind
from duelo.domain.review import Finding, ReviewResult
from duelo.workflows.activities import ReviewActivities
from duelo.workflows.dto import ArchiveReviewsInput
from tests.fakes.change_repository import FakeChangeRepository
from tests.fakes.project_slugs import FakeProjectSlugs
from tests.fakes.review_repository import FakeReviewRepository
from tests.fakes.session import FakeSessionFactory

WHEN = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)


class FakeArchive:
    def __init__(self, status: str = "pushed", detail: str = "") -> None:
        self.calls: list[tuple[str, str, str]] = []
        self._outcome = ArchiveOutcome(status, detail)

    async def archive(self, repo_path: str, sha: str, note: str) -> ArchiveOutcome:
        self.calls.append((repo_path, sha, note))
        return self._outcome


class FakePaths:
    def __init__(self, path: str | None) -> None:
        self._path = path

    async def path_of(self, project_id: UUID) -> str | None:
        return self._path


async def _world(
    *, archive: FakeArchive | None, path: str | None = "/repo"
) -> tuple[ReviewActivities, Change, FakeReviewRepository]:
    changes, reviews = FakeChangeRepository(), FakeReviewRepository()
    change = await ingest_change(
        changes,
        project_id=uuid4(),
        kind=ChangeKind.COMMIT,
        ref="refs/heads/main",
        head_sha="b" * 40,
        title="feat: x",
        author="a",
        url="https://example.com",
        diff="d",
        diff_truncated=False,
    )
    activities = ReviewActivities(
        session_factory=FakeSessionFactory(),  # type: ignore[arg-type]
        change_repository=lambda _session: changes,
        review_repository=lambda _session: reviews,
        agents={},
        archive=archive,
        project_paths=FakePaths(path),
        project_slugs=FakeProjectSlugs({change.project_id: "o/r"}),
        clock=lambda: WHEN,
    )
    return activities, change, reviews


async def test_the_note_carries_the_reviews_of_the_run_and_goes_to_the_project_repo() -> None:
    archive = FakeArchive()
    activities, change, reviews = await _world(archive=archive)
    await record_review_success(
        reviews,
        change=change,
        agent="claude",
        run=1,
        result=ReviewResult("bien", 9, (Finding("nit", "a.py", 1, "x"),)),
        raw_output="crudo",
        duration_ms=10,
    )
    await record_review_failure(reviews, change=change, agent="codex", run=1, error="falló")

    result = await activities.archive_reviews(ArchiveReviewsInput(change_id=str(change.id)))

    assert (result.status, result.detail) == ("pushed", "")
    [(repo_path, sha, note_text)] = archive.calls
    assert (repo_path, sha) == ("/repo", "b" * 40)
    note = json.loads(note_text)
    assert (note["project"], note["run"], note["written_at"]) == (
        "o/r",
        1,
        "2026-10-11T12:00:00+00:00",
    )
    assert [(r["agent"], r["status"]) for r in note["reviews"]] == [
        ("claude", "completed"),
        ("codex", "failed"),
    ]
    assert "crudo" not in note_text


async def test_only_the_requested_run_enters_the_note() -> None:
    archive = FakeArchive()
    activities, change, reviews = await _world(archive=archive)
    for run in (1, 2):
        await record_review_success(
            reviews,
            change=change,
            agent="claude",
            run=run,
            result=ReviewResult(f"run {run}", run, ()),
            raw_output=None,
            duration_ms=1,
        )

    await activities.archive_reviews(ArchiveReviewsInput(change_id=str(change.id), run=2))

    note = json.loads(archive.calls[0][2])
    assert [r["summary"] for r in note["reviews"]] == ["run 2"]


async def test_without_a_local_folder_nothing_is_archived() -> None:
    archive = FakeArchive()
    activities, change, _reviews = await _world(archive=archive, path=None)

    result = await activities.archive_reviews(ArchiveReviewsInput(change_id=str(change.id)))

    assert result.status == "skipped"
    assert "carpeta local" in result.detail
    assert archive.calls == []


async def test_with_notes_disabled_nothing_is_archived() -> None:
    activities, change, _reviews = await _world(archive=None)

    result = await activities.archive_reviews(ArchiveReviewsInput(change_id=str(change.id)))

    assert result.status == "skipped"
    assert "desactivadas" in result.detail


async def test_a_git_failure_is_reported_not_raised() -> None:
    archive = FakeArchive("failed", "el push falló")
    activities, change, _reviews = await _world(archive=archive)

    result = await activities.archive_reviews(ArchiveReviewsInput(change_id=str(change.id)))

    assert (result.status, result.detail) == ("failed", "el push falló")


async def test_an_unknown_change_is_a_non_retryable_error() -> None:
    activities, _change, _reviews = await _world(archive=FakeArchive())

    with pytest.raises(ApplicationError) as info:
        await activities.archive_reviews(ArchiveReviewsInput(change_id=str(uuid4())))

    assert info.value.non_retryable
