from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from duelo.domain.events import ReviewFailed
from duelo.domain.review import Review, ReviewResult, ReviewStatus
from tests.fakes.review_repository import FakeReviewRepository

T0 = datetime(2026, 1, 1, tzinfo=UTC)


async def _add(repo: FakeReviewRepository, change_id: UUID, agent: str, run: int, ok: bool) -> None:
    review = (
        Review.succeeded(
            change_id=change_id,
            agent=agent,
            run=run,
            result=ReviewResult(summary="ok", score=7),
            raw_output="crudo",
            duration_ms=1,
            created_at=T0,
        )
        if ok
        else Review.failed(
            change_id=change_id, agent=agent, run=run, error="x", duration_ms=1, created_at=T0
        )
    )
    event = ReviewFailed(
        review_id=review.id, change_id=change_id, project_id=uuid4(), agent=agent, error="x"
    )
    await repo.add(review, event)


async def test_status_counts_are_of_that_change_and_run_only() -> None:
    repo, change, other = FakeReviewRepository(), uuid4(), uuid4()
    await _add(repo, change, "claude", 1, ok=False)
    await _add(repo, change, "codex", 1, ok=False)
    await _add(repo, change, "claude", 2, ok=True)
    await _add(repo, change, "codex", 2, ok=False)
    await _add(repo, other, "claude", 2, ok=True)

    assert await repo.status_counts(change, run=2) == {
        ReviewStatus.COMPLETED: 1,
        ReviewStatus.FAILED: 1,
    }
    assert await repo.status_counts(change, run=3) == {}
