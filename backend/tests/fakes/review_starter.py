from __future__ import annotations

import asyncio
from collections.abc import Sequence
from uuid import UUID

from duelo.application.ports import ReviewStartError
from duelo.domain.change import Change


class FakeReviewStarter:
    """Registra qué commits arrancaron review y deduplica por (tipo, proyecto, sha, run), igual
    que el workflow id determinista del adaptador real. `yield_on_start` cede el control al
    arrancar para poder intercalar dos peticiones concurrentes."""

    def __init__(self, *, fail: bool = False, yield_on_start: bool = False) -> None:
        self.fail = fail
        self.yield_on_start = yield_on_start
        self.calls = 0
        self.started: dict[tuple[str, str, str, int], Change] = {}
        # (change, slug, agentes) de cada llamada, en orden: lo que el adaptador real pondría en
        # el id y en la entrada del workflow.
        self.received: list[tuple[UUID, str, tuple[str, ...]]] = []

    async def start(self, change: Change, *, project_slug: str, agent_names: Sequence[str]) -> None:
        self.calls += 1
        self.received.append((change.id, project_slug, tuple(agent_names)))
        if self.yield_on_start:
            await asyncio.sleep(0)
        if self.fail:
            raise ReviewStartError("Temporal caído (simulado)")
        self.started.setdefault(
            (change.kind.value, str(change.project_id), change.head_sha, change.run), change
        )
