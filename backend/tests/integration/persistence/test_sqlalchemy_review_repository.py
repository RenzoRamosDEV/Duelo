"""Test de integración con testcontainers (Postgres real). Fixtures en conftest.py."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from duelo.adapters.persistence.change_repository import SqlAlchemyChangeRepository
from duelo.adapters.persistence.models import EventModel, ReviewModel
from duelo.adapters.persistence.review_repository import SqlAlchemyReviewRepository
from duelo.application.ingest_change import ingest_change
from duelo.application.record_review import record_review_failure, record_review_success
from duelo.domain.change import Change, ChangeKind
from duelo.domain.review import ReviewResult, ReviewStatus
from tests.integration.conftest import create_project


async def _create_change(session_factory: async_sessionmaker, head_sha: str) -> Change:
    project_id = await create_project(session_factory)
    async with session_factory() as session:
        return await ingest_change(
            SqlAlchemyChangeRepository(session),
            project_id=project_id,
            kind=ChangeKind.COMMIT,
            ref="refs/heads/main",
            head_sha=head_sha,
            title="fix: algo",
            author="renzo",
            url="https://example.com/commit/" + head_sha,
            diff="diff --git a/x b/x",
            diff_truncated=False,
        )


async def test_two_agents_persist_two_reviews_for_the_same_change(
    session_factory: async_sessionmaker,
) -> None:
    change = await _create_change(session_factory, head_sha="a" * 40)
    result = ReviewResult(summary="todo bien", score=8, findings=())

    async with session_factory() as session:
        await record_review_success(
            SqlAlchemyReviewRepository(session),
            change=change,
            agent="agent_1",
            run=1,
            result=result,
            raw_output=None,
            duration_ms=100,
        )
    async with session_factory() as session:
        await record_review_success(
            SqlAlchemyReviewRepository(session),
            change=change,
            agent="agent_2",
            run=1,
            result=result,
            raw_output=None,
            duration_ms=120,
        )

    async with session_factory() as session:
        reviews = (
            (await session.execute(select(ReviewModel).where(ReviewModel.change_id == change.id)))
            .scalars()
            .all()
        )

    assert len(reviews) == 2
    assert {(r.agent, r.run) for r in reviews} == {("agent_1", 1), ("agent_2", 1)}


async def test_reregistering_same_review_natural_key_is_idempotent(
    session_factory: async_sessionmaker,
) -> None:
    change = await _create_change(session_factory, head_sha="b" * 40)
    result = ReviewResult(summary="ok", score=9, findings=())

    async def _record() -> None:
        async with session_factory() as session:
            await record_review_success(
                SqlAlchemyReviewRepository(session),
                change=change,
                agent="agent_1",
                run=1,
                result=result,
                raw_output=None,
                duration_ms=100,
            )

    await _record()
    await _record()

    async with session_factory() as session:
        reviews = (
            (await session.execute(select(ReviewModel).where(ReviewModel.change_id == change.id)))
            .scalars()
            .all()
        )
        events = (
            (await session.execute(select(EventModel).where(EventModel.type == "review.completed")))
            .scalars()
            .all()
        )

    assert len(reviews) == 1
    assert len([e for e in events if str(change.id) in str(e.payload.get("change_id"))]) == 1


async def test_failed_review_persists_with_failed_event(
    session_factory: async_sessionmaker,
) -> None:
    change = await _create_change(session_factory, head_sha="c" * 40)

    async with session_factory() as session:
        review = await record_review_failure(
            SqlAlchemyReviewRepository(session),
            change=change,
            agent="agent_2",
            run=1,
            error="timeout simulado",
        )

    assert review.status == "failed"

    async with session_factory() as session:
        row = await session.get(ReviewModel, review.id)
    assert row is not None
    assert (row.status, row.error, row.agent, row.run) == (
        "failed",
        "timeout simulado",
        "agent_2",
        1,
    )
    assert row.summary is None and row.score is None

    async with session_factory() as session:
        events = (
            (await session.execute(select(EventModel).where(EventModel.type == "review.failed")))
            .scalars()
            .all()
        )

    matching = [e for e in events if e.payload.get("change_id") == str(change.id)]
    assert len(matching) == 1
    assert matching[0].payload.get("error") == "timeout simulado"


async def test_reviews_a_pr_reuses_from_its_commit_count_once_in_the_stats(
    session_factory: async_sessionmaker,
) -> None:
    """«PR que reutiliza reviews»: la copia de la PR no suma otra review al agente, ni en el
    agregado global ni en el del proyecto."""
    project_id = await create_project(session_factory)
    sha = "e" * 40

    async def ingest(kind: ChangeKind) -> Change:
        async with session_factory() as session:
            return await ingest_change(
                SqlAlchemyChangeRepository(session),
                project_id=project_id,
                kind=kind,
                ref="main",
                head_sha=sha,
                title="feat: algo",
                author="renzo",
                url="",
                diff="diff --git a/x b/x",
                diff_truncated=False,
                agent_names=("claude",),
            )

    commit = await ingest(ChangeKind.COMMIT)
    async with session_factory() as session:
        await record_review_success(
            SqlAlchemyReviewRepository(session),
            change=commit,
            agent="claude",
            run=1,
            result=ReviewResult(summary="ok", score=8),
            raw_output=None,
            duration_ms=100,
        )
    pr = await ingest(ChangeKind.PR)
    async with session_factory() as session:
        assert await SqlAlchemyChangeRepository(session).has_reused_reviews(pr.id)

    for scope in (None, project_id):
        async with session_factory() as session:
            stats = await SqlAlchemyReviewRepository(session).agent_stats(project_id=scope)
        claude = next(s for s in stats if s.agent == "claude")
        assert (claude.total, claude.completed, claude.avg_score) == (1, 1, 8.0), scope


# --- lecturas sin salida cruda y recuento por estado -----------------------------------------


@contextmanager
def _statements(engine: AsyncEngine) -> Iterator[list[str]]:
    seen: list[str] = []

    def capture(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        seen.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", capture)
    try:
        yield seen
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", capture)


async def _record(
    session_factory: async_sessionmaker, change: Change, agent: str, run: int, *, ok: bool
) -> None:
    async with session_factory() as session:
        repository = SqlAlchemyReviewRepository(session)
        if ok:
            await record_review_success(
                repository,
                change=change,
                agent=agent,
                run=run,
                result=ReviewResult(summary="ok", score=7),
                raw_output="salida cruda " * 1000,
                duration_ms=10,
            )
        else:
            await record_review_failure(repository, change=change, agent=agent, run=run, error="x")


async def test_listing_the_reviews_of_a_change_does_not_read_their_raw_output(
    engine: AsyncEngine, session_factory: async_sessionmaker
) -> None:
    change = await _create_change(session_factory, head_sha="f" * 40)
    for run in (1, 2):
        await _record(session_factory, change, "claude", run, ok=True)

    with _statements(engine) as seen:
        async with session_factory() as session:
            listed = await SqlAlchemyReviewRepository(session).list_for_change(change.id)

    assert [(r.run, r.raw_output) for r in listed] == [(1, None), (2, None)]
    assert all(r.summary == "ok" for r in listed)
    (statement,) = seen
    assert "raw_output" not in statement
    async with session_factory() as session:
        full = await SqlAlchemyReviewRepository(session).get(listed[0].id)
    assert full is not None and full.raw_output == "salida cruda " * 1000


async def test_status_counts_are_of_the_requested_run_only_in_one_grouped_query(
    engine: AsyncEngine, session_factory: async_sessionmaker
) -> None:
    change = await _create_change(session_factory, head_sha="1" * 40)
    await _record(session_factory, change, "claude", 1, ok=False)
    await _record(session_factory, change, "codex", 1, ok=False)
    await _record(session_factory, change, "claude", 2, ok=True)
    await _record(session_factory, change, "codex", 2, ok=False)

    with _statements(engine) as seen:
        async with session_factory() as session:
            counts = await SqlAlchemyReviewRepository(session).status_counts(change.id, run=2)

    assert counts == {ReviewStatus.COMPLETED: 1, ReviewStatus.FAILED: 1}
    (statement,) = [s for s in seen if "FROM reviews" in s]
    assert "GROUP BY" in statement


async def test_status_counts_of_a_run_without_reviews_are_empty(
    session_factory: async_sessionmaker,
) -> None:
    change = await _create_change(session_factory, head_sha="2" * 40)
    await _record(session_factory, change, "claude", 1, ok=True)

    async with session_factory() as session:
        assert await SqlAlchemyReviewRepository(session).status_counts(change.id, run=3) == {}
