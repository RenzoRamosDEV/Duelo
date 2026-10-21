"""Lecturas que no retienen una transacción en una sesión compartida."""

from __future__ import annotations

from sqlalchemy import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import TypedReturnsRows


async def short_read[*Ts](session: AsyncSession, statement: TypedReturnsRows[*Ts]) -> Result[*Ts]:
    """Ejecuta `statement` y, si la sesión no estaba ya en una transacción, termina la que abre.

    Una sesión sin transacción la autoinicia en la primera consulta y la mantiene hasta el
    siguiente `commit`: un caso de uso que lee y después espera a un servicio externo (Temporal,
    `gh`) dejaría la conexión «idle in transaction» toda la espera. Dentro de una transacción ya
    abierta se ejecuta en ella, para no cerrársela a quien la abrió. El resultado ya está leído
    (`AsyncSession.execute` lo devuelve en memoria) y se puede consumir después."""
    if session.in_transaction():
        return await session.execute(statement)
    async with session.begin():
        return await session.execute(statement)
