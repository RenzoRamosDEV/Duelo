"""Medición de la sincronización de PRs con el adaptador real de `gh` (un `gh` falso en el PATH).

Vive aquí y no en `tests/unit/application` porque usa un adaptador: la configuración de `mutmut`
solo copia `domain/` y `application/`."""

from __future__ import annotations

from pathlib import Path

import pytest

from duelo.adapters.github.gh_cli import GhPrSource
from duelo.application.ingest_commit import ChangeSubmission, IngestResult, ingest_pr
from duelo.application.local_projects import SyncResult, add_local_project, sync_pull_requests
from duelo.application.ports import RepoInfo
from tests.fakes.change_repository import FakeChangeRepository
from tests.fakes.event_log import FakeEventLog
from tests.fakes.gh import fake_gh
from tests.fakes.local_projects import FakeGitRepository, FakeHookInstaller
from tests.fakes.project_repository import FakeProjectRepository
from tests.fakes.review_repository import FakeReviewRepository
from tests.fakes.review_starter import FakeReviewStarter


class _Ingest:
    """`ingest_pr` real sobre repositorios en memoria."""

    def __init__(self, catalog: FakeProjectRepository) -> None:
        events = FakeEventLog()
        self.changes = FakeChangeRepository(FakeReviewRepository(events), events)
        self.catalog = catalog
        self.starter = FakeReviewStarter()

    async def __call__(self, submission: ChangeSubmission) -> IngestResult:
        return await ingest_pr(
            self.catalog, self.changes, self.starter, submission, max_diff_chars=200_000
        )


def _gh_listing(count: int) -> list[dict[str, object]]:
    return [
        {
            "number": n,
            "title": f"feat: pr {n}",
            "author": {"login": "ana"},
            "headRefName": f"feature-{n}",
            "headRefOid": f"{n:040x}",
            "url": f"https://github.com/acme/widgets/pull/{n}",
            "updatedAt": "2026-10-10T10:00:00Z",
        }
        for n in range(1, count + 1)
    ]


async def test_a_cycle_without_new_heads_costs_no_gh_diff_nor_start(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Medición: con 30 PRs ya registradas, cuántos `gh pr diff` y `starter.start` cuesta un
    ciclo de sincronización con el adaptador real de `gh`."""
    bin_dir = tmp_path / "bin"
    monkeypatch.setenv("PATH", f"{bin_dir}:/usr/bin:/bin")
    fake_gh(bin_dir, _gh_listing(30))
    catalog = FakeProjectRepository()
    git = FakeGitRepository(
        RepoInfo(root=str(tmp_path), remote_url="git@github.com:acme/widgets.git")
    )
    await add_local_project(git, FakeHookInstaller(), catalog, str(tmp_path))
    ingest = _Ingest(catalog)
    await sync_pull_requests(catalog, ingest.changes, GhPrSource(), ingest, "acme/widgets")
    (bin_dir / "calls").unlink()
    starts_before = ingest.starter.calls

    result = await sync_pull_requests(catalog, ingest.changes, GhPrSource(), ingest, "acme/widgets")

    calls = (bin_dir / "calls").read_text().splitlines()
    diffs = [c for c in calls if c.startswith("pr diff")]
    assert (len(diffs), ingest.starter.calls - starts_before) == (0, 0)
    assert result == SyncResult(synced=30, created=0)
