from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from duelo.adapters.persistence.models import ProjectModel
from duelo.application.ports import ProjectAlreadyExists
from duelo.domain.project import Project, effective_agents


def _unqueryable(slug: str) -> bool:
    # Ningún proyecto puede llamarse así y Postgres rechazaría la consulta con un 500.
    return "\x00" in slug


def _to_domain(row: ProjectModel, available: Sequence[str] = ()) -> Project:
    return Project(
        id=row.id,
        slug=row.slug,
        path=row.path,
        hooks_installed=row.hooks_installed,
        github=row.github,
        agents=effective_agents(row.agents, available),
    )


class SqlAlchemyProjectRepository:
    """Lectura corta con su propia sesión: así la consulta no deja una transacción abierta
    que choque con el `session.begin()` que usa `SqlAlchemyChangeRepository.add`. También es el
    catálogo de proyectos locales (alta y baja)."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        available_agents: Sequence[str] = (),
    ) -> None:
        self._session_factory = session_factory
        # Los agentes configurados (`AGENT_NAMES`): la selección de cada proyecto es un subconjunto.
        self._available = tuple(available_agents)

    async def get_by_slug(self, slug: str) -> Project | None:
        if _unqueryable(slug):
            return None
        async with self._session_factory() as session:
            row = (
                await session.execute(select(ProjectModel).where(ProjectModel.slug == slug))
            ).scalar_one_or_none()
        return _to_domain(row, self._available) if row is not None else None

    async def path_of(self, project_id: UUID) -> str | None:
        """Implementa `ProjectPaths`: la carpeta local del proyecto, o `None` si no existe el
        proyecto o se creó sin carpeta."""
        async with self._session_factory() as session:
            return (
                await session.execute(
                    select(ProjectModel.path).where(ProjectModel.id == project_id)
                )
            ).scalar_one_or_none()

    async def slug_of(self, project_id: UUID) -> str | None:
        """Implementa `ProjectSlugs`: el nombre del proyecto, o `None` si no existe."""
        async with self._session_factory() as session:
            return (
                await session.execute(
                    select(ProjectModel.slug).where(ProjectModel.id == project_id)
                )
            ).scalar_one_or_none()

    async def agents_of(self, project_id: UUID) -> tuple[str, ...]:
        """Implementa `ProjectAgents`: la selección efectiva del proyecto (vacía si no existe)."""
        async with self._session_factory() as session:
            row = (
                await session.execute(select(ProjectModel).where(ProjectModel.id == project_id))
            ).scalar_one_or_none()
        return _to_domain(row, self._available).agents if row is not None else ()

    async def save_agents(self, slug: str, agents: Sequence[str]) -> Project | None:
        """Guarda la selección del proyecto y lo devuelve; `None` si no existe."""
        if _unqueryable(slug):
            return None
        async with self._session_factory() as session:
            row = (
                await session.execute(
                    update(ProjectModel)
                    .where(ProjectModel.slug == slug)
                    .values(agents=list(agents))
                    .returning(ProjectModel)
                )
            ).scalar_one_or_none()
            await session.commit()
            return _to_domain(row, self._available) if row is not None else None

    async def list_all(self) -> list[Project]:
        async with self._session_factory() as session:
            rows = (
                await session.execute(select(ProjectModel).order_by(ProjectModel.slug))
            ).scalars()
            return [_to_domain(row, self._available) for row in rows]

    async def list_local(self) -> list[Project]:
        async with self._session_factory() as session:
            rows = (
                await session.execute(
                    select(ProjectModel)
                    .where(ProjectModel.path.is_not(None))
                    .order_by(ProjectModel.slug)
                )
            ).scalars()
            return [_to_domain(row, self._available) for row in rows]

    async def add_local(self, project: Project) -> Project:
        row = ProjectModel(
            id=project.id,
            slug=project.slug,
            path=project.path,
            hooks_installed=project.hooks_installed,
            github=project.github,
        )
        async with self._session_factory() as session:
            session.add(row)
            try:
                await session.commit()
            except IntegrityError as exc:  # slug o carpeta repetidos (restricciones únicas)
                await session.rollback()
                raise ProjectAlreadyExists(project.slug) from exc
            return _to_domain(row, self._available)

    async def remove(self, slug: str) -> Project | None:
        if _unqueryable(slug):
            return None
        async with self._session_factory() as session:
            row = (
                await session.execute(select(ProjectModel).where(ProjectModel.slug == slug))
            ).scalar_one_or_none()
            if row is None:
                return None
            project = _to_domain(row, self._available)
            # Las FK ON DELETE CASCADE se llevan changes, reviews y eventos.
            await session.execute(delete(ProjectModel).where(ProjectModel.id == row.id))
            await session.commit()
            return project
