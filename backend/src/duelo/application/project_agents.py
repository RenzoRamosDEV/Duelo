from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from duelo.application.ingest_commit import ProjectNotFound
from duelo.application.ports import ProjectAgents
from duelo.domain.change import Change
from duelo.domain.project import Project


class InvalidAgentSelection(Exception):
    """La selección está vacía, repite un agente o incluye uno no disponible (mensaje para el
    usuario)."""


async def set_project_agents(
    projects: ProjectAgents, slug: str, agents: Sequence[str], *, available: Sequence[str]
) -> Project:
    """Guarda qué agentes evalúan el proyecto. Aplica a lo que se ingiera o reintente después:
    las reviews ya hechas y las ejecuciones en vuelo no cambian."""
    if not agents:
        raise InvalidAgentSelection("Elige al menos un agente")
    if len(set(agents)) != len(agents):
        raise InvalidAgentSelection("La selección repite un agente")
    unknown = [name for name in agents if name not in available]
    if unknown:
        raise InvalidAgentSelection(f"Agente no disponible: {', '.join(unknown)}")
    project = await projects.save_agents(slug, agents)
    if project is None:
        raise ProjectNotFound(slug)
    return project


async def expected_agents_for(
    projects: ProjectAgents | None, project_id: UUID, fallback: int
) -> int:
    """Reviews que se esperan de un change: los agentes elegidos de su proyecto, o `fallback`
    (los configurados) si no se conocen."""
    if projects is None:
        return fallback
    return len(await projects.agents_of(project_id)) or fallback


async def expected_agents_of(change: Change, projects: ProjectAgents | None, fallback: int) -> int:
    """Reviews que espera el run actual de `change`: las guardadas al arrancarlo o, en un change
    que no las guardó, las de la selección actual (ver `expected_agents_for`)."""
    if change.expected_agents is not None:
        return change.expected_agents
    return await expected_agents_for(projects, change.project_id, fallback)
