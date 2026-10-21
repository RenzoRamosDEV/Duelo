from uuid import uuid4

from duelo.application.ingest_change import ingest_change
from duelo.domain.change import ChangeKind
from tests.fakes.change_repository import FakeChangeRepository


async def test_get_returns_none_for_unknown_id() -> None:
    repo = FakeChangeRepository()

    assert await repo.get(uuid4()) is None


async def test_get_returns_the_persisted_change() -> None:
    repo = FakeChangeRepository()
    project_id = uuid4()

    created = await ingest_change(
        repo,
        project_id=project_id,
        kind=ChangeKind.COMMIT,
        ref="refs/heads/main",
        head_sha="a" * 40,
        title="fix: algo",
        author="renzo",
        url="https://example.com",
        diff="diff --git a/x b/x",
        diff_truncated=False,
    )

    fetched = await repo.get(created.id)

    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.head_sha == "a" * 40


async def test_registered_heads_are_the_listed_shas_stored_with_that_kind_in_that_project() -> None:
    repo, project, other = FakeChangeRepository(), uuid4(), uuid4()
    for owner, sha, kind in [
        (project, "a" * 40, ChangeKind.PR),
        (project, "b" * 40, ChangeKind.COMMIT),
        (other, "c" * 40, ChangeKind.PR),
    ]:
        await ingest_change(
            repo,
            project_id=owner,
            kind=kind,
            ref="feature",
            head_sha=sha,
            title="t",
            author="a",
            url="",
            diff="d",
            diff_truncated=False,
        )

    heads = await repo.registered_heads(project, ChangeKind.PR, ["a" * 40, "b" * 40, "c" * 40])

    assert heads == frozenset({"a" * 40})
    assert await repo.registered_heads(project, ChangeKind.PR, []) == frozenset()
