from uuid import uuid4

from sqlalchemy.ext.asyncio import async_sessionmaker

from duelo.adapters.persistence.project_repository import SqlAlchemyProjectRepository
from tests.integration.conftest import create_project


async def test_returns_the_existing_project_by_slug(session_factory: async_sessionmaker) -> None:
    project_id = await create_project(session_factory)

    project = await SqlAlchemyProjectRepository(session_factory).get_by_slug(f"test-{project_id}")

    assert project is not None
    assert project.id == project_id and project.slug == f"test-{project_id}"


async def test_returns_none_for_an_unknown_slug(session_factory: async_sessionmaker) -> None:
    assert await SqlAlchemyProjectRepository(session_factory).get_by_slug("no-existe") is None


async def test_a_slug_with_nul_is_simply_unknown_instead_of_failing(
    session_factory: async_sessionmaker,
) -> None:
    assert await SqlAlchemyProjectRepository(session_factory).get_by_slug("a\x00b") is None


async def test_returns_the_project_by_id_with_its_effective_agents(
    session_factory: async_sessionmaker,
) -> None:
    project_id = await create_project(session_factory)
    repository = SqlAlchemyProjectRepository(session_factory, ["claude", "codex"])
    await repository.save_agents(f"test-{project_id}", ["codex"])

    project = await repository.get(project_id)

    assert project is not None
    assert (project.id, project.slug, project.agents) == (
        project_id,
        f"test-{project_id}",
        ("codex",),
    )


async def test_returns_none_for_an_unknown_id(session_factory: async_sessionmaker) -> None:
    assert await SqlAlchemyProjectRepository(session_factory).get(uuid4()) is None
