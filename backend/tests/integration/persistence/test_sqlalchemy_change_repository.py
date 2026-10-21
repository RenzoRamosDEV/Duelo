"""Test de integración con testcontainers (Postgres real). Fixtures en conftest.py."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from duelo.adapters.persistence.change_repository import SqlAlchemyChangeRepository
from duelo.adapters.persistence.models import ChangeModel, EventModel
from duelo.application.ingest_change import ingest_change
from duelo.domain.change import Change, ChangeKind
from duelo.domain.events import ChangeCreated
from tests.integration.conftest import create_project


async def test_ingest_change_persists_change_and_event_atomically(
    session_factory: async_sessionmaker,
) -> None:
    project_id = await create_project(session_factory)

    async with session_factory() as session:
        change = await ingest_change(
            SqlAlchemyChangeRepository(session),
            project_id=project_id,
            kind=ChangeKind.COMMIT,
            ref="refs/heads/main",
            head_sha="a" * 40,
            title="fix: algo",
            author="renzo",
            url="https://example.com/commit/a",
            diff="diff --git a/x b/x",
            diff_truncated=False,
        )

    async with session_factory() as session:
        stored = (
            await session.execute(select(ChangeModel).where(ChangeModel.id == change.id))
        ).scalar_one()
        events = (
            (await session.execute(select(EventModel).where(EventModel.project_id == project_id)))
            .scalars()
            .all()
        )

    assert stored.head_sha == "a" * 40
    assert len(events) == 1
    assert events[0].type == "change.created"


async def test_reingesting_same_natural_key_is_idempotent(
    session_factory: async_sessionmaker,
) -> None:
    project_id = await create_project(session_factory)

    async def _ingest() -> Change:
        async with session_factory() as session:
            return await ingest_change(
                SqlAlchemyChangeRepository(session),
                project_id=project_id,
                kind=ChangeKind.COMMIT,
                ref="refs/heads/main",
                head_sha="b" * 40,
                title="fix: algo",
                author="renzo",
                url="https://example.com/commit/b",
                diff="diff --git a/x b/x",
                diff_truncated=False,
            )

    first = await _ingest()
    second = await _ingest()

    assert first.id == second.id

    async with session_factory() as session:
        events = (
            (await session.execute(select(EventModel).where(EventModel.project_id == project_id)))
            .scalars()
            .all()
        )
    assert len(events) == 1


async def test_same_head_sha_in_different_projects_are_independent(
    session_factory: async_sessionmaker,
) -> None:
    head_sha = "d" * 40

    async def _ingest(project_id: UUID) -> Change:
        async with session_factory() as session:
            return await ingest_change(
                SqlAlchemyChangeRepository(session),
                project_id=project_id,
                kind=ChangeKind.COMMIT,
                ref="refs/heads/main",
                head_sha=head_sha,
                title="fix: algo",
                author="renzo",
                url="https://example.com/commit/d",
                diff="diff --git a/x b/x",
                diff_truncated=False,
            )

    project_a = await create_project(session_factory)
    project_b = await create_project(session_factory)

    first = await _ingest(project_a)
    second = await _ingest(project_b)

    assert first.id != second.id


async def test_rolls_back_change_if_event_write_fails(
    session_factory: async_sessionmaker,
) -> None:
    project_id = await create_project(session_factory)
    change = Change.new(
        project_id=project_id,
        kind=ChangeKind.COMMIT,
        ref="refs/heads/main",
        head_sha="e" * 40,
        title="fix: algo",
        author="renzo",
        url="https://example.com/commit/e",
        diff="diff --git a/x b/x",
        diff_truncated=False,
        created_at=datetime.now(UTC),
    )
    # project_id inexistente en el evento -> viola la FK de events.project_id,
    # forzando que la escritura del evento falle dentro de la misma transacción.
    broken_event = ChangeCreated(
        change_id=change.id,
        project_id=uuid4(),
        kind=change.kind.value,
        head_sha=change.head_sha,
    )

    async with session_factory() as session:
        with pytest.raises(Exception, match=r"(?i)foreign key"):
            await SqlAlchemyChangeRepository(session).add(change, broken_event)

    async with session_factory() as session:
        row = (
            await session.execute(select(ChangeModel).where(ChangeModel.id == change.id))
        ).scalar_one_or_none()
    assert row is None


# --- cabezas registradas ---------------------------------------------------------------------


async def _register(
    session_factory: async_sessionmaker, project_id: UUID, sha: str, kind: ChangeKind
) -> None:
    async with session_factory() as session:
        await ingest_change(
            SqlAlchemyChangeRepository(session),
            project_id=project_id,
            kind=kind,
            ref="feature",
            head_sha=sha,
            title="t",
            author="a",
            url="",
            diff="d",
            diff_truncated=False,
        )


async def test_registered_heads_are_the_listed_shas_already_stored_with_that_kind(
    session_factory: async_sessionmaker,
) -> None:
    project, other = await create_project(session_factory), await create_project(session_factory)
    aaa, bbb, ccc = "a" * 40, "b" * 40, "c" * 40
    await _register(session_factory, project, aaa, ChangeKind.PR)
    await _register(session_factory, project, bbb, ChangeKind.COMMIT)
    await _register(session_factory, other, ccc, ChangeKind.PR)

    async with session_factory() as session:
        repository = SqlAlchemyChangeRepository(session)
        mine = await repository.registered_heads(project, ChangeKind.PR, [aaa, bbb, ccc])
        elsewhere = await repository.registered_heads(other, ChangeKind.PR, [aaa, bbb])

    assert mine == frozenset({aaa})
    assert elsewhere == frozenset()


async def test_registered_heads_of_no_shas_is_empty_without_a_query(
    session_factory: async_sessionmaker,
) -> None:
    project = await create_project(session_factory)
    async with session_factory() as session:
        executed: list[object] = []
        real_execute = session.execute

        async def spy(*args: object, **kwargs: object) -> object:
            executed.append(args[0])
            return await real_execute(*args, **kwargs)  # type: ignore[arg-type]

        session.execute = spy  # type: ignore[method-assign]
        heads = await SqlAlchemyChangeRepository(session).registered_heads(
            project, ChangeKind.PR, []
        )

    assert heads == frozenset()
    assert executed == []


async def test_registered_heads_leaves_no_transaction_open(
    session_factory: async_sessionmaker,
) -> None:
    project = await create_project(session_factory)
    async with session_factory() as session:
        await SqlAlchemyChangeRepository(session).registered_heads(
            project, ChangeKind.PR, ["a" * 40]
        )

        assert session.in_transaction() is False
