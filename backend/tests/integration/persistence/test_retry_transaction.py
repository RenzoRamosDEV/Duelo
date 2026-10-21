"""El reintento no retiene una transacción abierta mientras arranca la ejecución en Temporal."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from duelo.adapters.persistence.change_repository import SqlAlchemyChangeRepository
from duelo.adapters.persistence.models import ChangeModel
from duelo.adapters.persistence.project_repository import SqlAlchemyProjectRepository
from duelo.adapters.persistence.review_repository import SqlAlchemyReviewRepository
from duelo.application.ingest_change import ingest_change
from duelo.application.ports import ReviewStartError
from duelo.application.record_review import record_review_failure
from duelo.application.retry_review import retry_review
from duelo.domain.change import Change, ChangeKind
from tests.integration.conftest import create_project

AGENTS = ("claude", "codex")
NOW = datetime(2026, 3, 1, tzinfo=UTC)


class _SessionWatchingStarter:
    """Anota si la sesión del reintento tiene una transacción abierta al arrancar."""

    def __init__(self, session: AsyncSession, *, fail: bool = False) -> None:
        self._session = session
        self._fail = fail
        self.in_transaction: list[bool] = []

    async def start(self, change: Change, *, project_slug: str, agent_names: Sequence[str]) -> None:
        self.in_transaction.append(self._session.in_transaction())
        if self._fail:
            raise ReviewStartError("Temporal caído (simulado)")


async def _failed_change(session_factory: async_sessionmaker) -> Change:
    project = await create_project(session_factory)
    async with session_factory() as session:
        change = await ingest_change(
            SqlAlchemyChangeRepository(session),
            project_id=project,
            kind=ChangeKind.COMMIT,
            ref="main",
            head_sha="9" * 40,
            title="t",
            author="a",
            url="",
            diff="d",
            diff_truncated=False,
            agent_names=AGENTS,
        )
    for agent in AGENTS:
        async with session_factory() as session:
            await record_review_failure(
                SqlAlchemyReviewRepository(session), change=change, agent=agent, run=1, error="x"
            )
    return change


async def _run_of(session_factory: async_sessionmaker, change_id: UUID) -> int:
    async with session_factory() as session:
        return (
            await session.execute(select(ChangeModel.run).where(ChangeModel.id == change_id))
        ).scalar_one()


async def _retry(
    session_factory: async_sessionmaker,
    session: AsyncSession,
    starter: _SessionWatchingStarter,
    change: Change,
) -> Change:
    return await retry_review(
        SqlAlchemyChangeRepository(session),
        SqlAlchemyReviewRepository(session),
        SqlAlchemyProjectRepository(session_factory),
        starter,
        change.id,
        agent_names=AGENTS,
        now=NOW,
    )


async def test_no_transaction_is_open_while_the_execution_starts(
    session_factory: async_sessionmaker,
) -> None:
    change = await _failed_change(session_factory)

    async with session_factory() as session:
        starter = _SessionWatchingStarter(session)
        retried = await _retry(session_factory, session, starter, change)

    assert starter.in_transaction == [False]
    assert retried.run == 2
    assert await _run_of(session_factory, change.id) == 2


async def test_a_failed_start_leaves_run_untouched_and_no_transaction_open(
    session_factory: async_sessionmaker,
) -> None:
    change = await _failed_change(session_factory)

    async with session_factory() as session:
        starter = _SessionWatchingStarter(session, fail=True)
        with pytest.raises(ReviewStartError):
            await _retry(session_factory, session, starter, change)
        assert session.in_transaction() is False

    assert starter.in_transaction == [False]
    assert await _run_of(session_factory, change.id) == 1
