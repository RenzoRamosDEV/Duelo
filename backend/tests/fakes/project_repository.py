from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace
from uuid import UUID

from duelo.application.ports import ProjectAlreadyExists
from duelo.domain.project import Project, effective_agents


class FakeProjectRepository:
    """Repositorio de proyectos en memoria; también hace de catálogo de proyectos locales."""

    def __init__(self, *projects: Project, available_agents: Sequence[str] = ()) -> None:
        self._by_slug = {p.slug: p for p in projects}
        self._available = tuple(available_agents)

    async def agents_of(self, project_id: UUID) -> tuple[str, ...]:
        return next((p.agents for p in self._by_slug.values() if p.id == project_id), ())

    async def save_agents(self, slug: str, agents: Sequence[str]) -> Project | None:
        project = self._by_slug.get(slug)
        if project is None:
            return None
        saved = replace(project, agents=effective_agents(agents, self._available))
        self._by_slug[slug] = saved
        return saved

    async def get_by_slug(self, slug: str) -> Project | None:
        return self._by_slug.get(slug)

    async def list_all(self) -> list[Project]:
        return sorted(self._by_slug.values(), key=lambda p: p.slug)

    async def add_local(self, project: Project) -> Project:
        taken_paths = {p.path for p in self._by_slug.values() if p.path is not None}
        if project.slug in self._by_slug or project.path in taken_paths:
            raise ProjectAlreadyExists(project.slug)
        project = replace(project, agents=effective_agents(None, self._available))
        self._by_slug[project.slug] = project
        return project

    async def remove(self, slug: str) -> Project | None:
        return self._by_slug.pop(slug, None)

    async def list_local(self) -> list[Project]:
        return [p for p in await self.list_all() if p.path is not None]
