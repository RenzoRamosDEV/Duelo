"""Escritura del outbox: una fila en `events` por evento de dominio.

Se llama dentro de la transacción de quien emite el evento (change, review, marca de commit),
que es lo que hace al outbox fiable: o se guardan los dos, o ninguno.
"""

from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from duelo.adapters.persistence.models import EventModel
from duelo.adapters.persistence.sanitize import sanitize_json


class DomainEvent(Protocol):
    """Lo que todo evento de `duelo.domain.events` ofrece al outbox."""

    @property
    def project_id(self) -> UUID: ...

    @property
    def type(self) -> str: ...

    def to_payload(self) -> dict[str, Any]: ...


async def append_event(session: AsyncSession, event: DomainEvent) -> None:
    await session.execute(
        insert(EventModel).values(
            project_id=event.project_id,
            type=event.type,
            payload=sanitize_json(event.to_payload()),
        )
    )
