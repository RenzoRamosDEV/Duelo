"""Puertos de los proyectos: lecturas por slug e id, selección de agentes y catálogo local."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from duelo.domain.project import Project


class ProjectPaths(Protocol):
    async def path_of(self, project_id: UUID) -> str | None:
        """Devuelve la carpeta local del proyecto, o `None` si no existe o no tiene carpeta.

        Es lo único que un agente necesita saber de un proyecto, y le permite leer el repositorio
        sin que la ruta viaje por los DTOs de Temporal."""
        ...


class ProjectSlugs(Protocol):
    async def slug_of(self, project_id: UUID) -> str | None:
        """Devuelve el nombre (`owner/repo`) del proyecto, o `None` si no existe.

        Lo usa quien arranca un workflow para darle un nombre legible en la interfaz de Temporal."""
        ...


class ProjectRepository(Protocol):
    async def get(self, project_id: UUID) -> Project | None:
        """Devuelve el proyecto con ese id (con su selección efectiva de agentes), o `None` si no
        existe."""
        ...

    async def get_by_slug(self, slug: str) -> Project | None:
        """Devuelve el proyecto con ese slug, o `None` si no existe."""
        ...

    async def list_all(self) -> list[Project]:
        """Devuelve todos los proyectos ordenados por slug."""
        ...


class ProjectAgents(Protocol):
    async def agents_of(self, project_id: UUID) -> tuple[str, ...]:
        """Selección efectiva de agentes del proyecto; vacía si el proyecto no existe."""
        ...

    async def save_agents(self, slug: str, agents: Sequence[str]) -> Project | None:
        """Guarda la selección de agentes del proyecto y lo devuelve; `None` si no existe."""
        ...


class ProjectAlreadyExists(Exception):
    """Ya hay un proyecto con ese slug o con esa carpeta."""


class ProjectCatalog(Protocol):
    async def add_local(self, project: Project) -> Project:
        """Registra un proyecto local. Lanza `ProjectAlreadyExists` si el slug o la carpeta ya
        están registrados."""
        ...

    async def remove(self, slug: str) -> Project | None:
        """Elimina el proyecto y, en cascada, sus changes, reviews y eventos. Devuelve el proyecto
        eliminado, o `None` si no existía."""
        ...

    async def list_local(self) -> list[Project]:
        """Proyectos dados de alta desde una carpeta, ordenados por slug."""
        ...
