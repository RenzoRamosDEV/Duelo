"""`short_read`: una lectura que no deja la sesión con una transacción abierta."""

from __future__ import annotations

from sqlalchemy import literal, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from duelo.adapters.persistence.transactions import short_read


async def test_outside_a_transaction_the_read_commits_its_own(
    session_factory: async_sessionmaker,
) -> None:
    async with session_factory() as session:
        result = await short_read(session, select(literal(7)))

        assert result.scalar_one() == 7
        assert session.in_transaction() is False


async def test_inside_an_open_transaction_the_read_joins_it_without_closing_it(
    session_factory: async_sessionmaker,
) -> None:
    async with session_factory() as session, session.begin():
        result = await short_read(session, select(literal(7)))

        assert result.scalar_one() == 7
        assert session.in_transaction() is True
