"""Puerto del orquestador: arrancar la review de un change."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from duelo.domain.change import Change


class ReviewStartError(Exception):
    """El orquestador no pudo arrancar la review (p. ej. Temporal caído)."""


class ReviewStarter(Protocol):
    async def start(self, change: Change, *, project_slug: str, agent_names: Sequence[str]) -> None:
        """Arranca la review de `change` por `agent_names` (`project_slug` le da nombre legible).
        Quien llama ya tiene el proyecto cargado: el starter no consulta nada más. Idempotente:
        si ya estaba arrancada (o terminó) para ese change, no hace nada. Lanza
        `ReviewStartError` si no se pudo arrancar."""
        ...
