from __future__ import annotations

from collections.abc import Awaitable, Callable
from functools import partial
from pathlib import Path

import pytest

from duelo.adapters.github import gh_cli
from duelo.adapters.github.gh_cli import GhPrSource
from duelo.adapters.subprocess_runner import run_command
from duelo.application.ports import GithubUnavailable
from tests.fakes.gh import fake_gh

LISTING = [
    {
        "number": 7,
        "title": "feat: algo",
        "author": {"login": "ana"},
        "headRefName": "feature-x",
        "headRefOid": "a" * 40,
        "url": "https://github.com/acme/widgets/pull/7",
        "updatedAt": "2026-10-10T10:00:00Z",
    },
    {
        "number": 8,
        "title": "fix: otra",
        "author": None,
        "headRefName": "fix-y",
        "headRefOid": "b" * 40,
        "url": "https://github.com/acme/widgets/pull/8",
        "updatedAt": "2026-10-10T11:00:00Z",
    },
]

DIFF_OF_7 = "diff de la PR 7\n"

Query = Callable[[GhPrSource, str], Awaitable[object]]
# Los errores de `gh` se informan igual al listar que al pedir un diff.
QUERIES = pytest.mark.parametrize(
    "query",
    [
        pytest.param(lambda gh, root: gh.open_prs(root), id="open_prs"),
        pytest.param(lambda gh, root: gh.pr_diff(root, 7), id="pr_diff"),
    ],
)


@pytest.fixture
def bin_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "bin"
    monkeypatch.setenv("PATH", f"{path}:/usr/bin:/bin")
    return path


async def test_lists_open_prs_without_asking_for_any_diff(bin_dir: Path, tmp_path: Path) -> None:
    fake_gh(bin_dir, LISTING)

    pulls = await GhPrSource().open_prs(str(tmp_path))

    assert [(p.number, p.title, p.author, p.ref, p.head_sha, p.url) for p in pulls] == [
        (7, "feat: algo", "ana", "feature-x", "a" * 40, LISTING[0]["url"]),
        (8, "fix: otra", "", "fix-y", "b" * 40, LISTING[1]["url"]),
    ]
    calls = (bin_dir / "calls").read_text().splitlines()
    assert [c.split()[:2] for c in calls] == [["pr", "list"]]


async def test_the_diff_of_one_pr_is_asked_by_its_number(bin_dir: Path, tmp_path: Path) -> None:
    fake_gh(bin_dir, LISTING)

    diff = await GhPrSource().pr_diff(str(tmp_path), 7)

    assert diff == DIFF_OF_7
    assert (bin_dir / "calls").read_text().splitlines() == ["pr diff 7"]


async def test_asks_gh_for_open_prs_with_a_bounded_list(bin_dir: Path, tmp_path: Path) -> None:
    fake_gh(bin_dir, LISTING)

    await GhPrSource().open_prs(str(tmp_path))

    first_call = (bin_dir / "calls").read_text().splitlines()[0]
    assert first_call == (
        f"pr list --state open --limit {gh_cli.MAX_PRS} --json "
        "number,title,author,headRefName,headRefOid,url,updatedAt"
    )


async def test_malformed_entries_are_skipped_without_losing_the_good_ones(
    bin_dir: Path, tmp_path: Path
) -> None:
    good = LISTING[0]
    broken = [
        "no-es-un-objeto",
        {**good, "number": "7"},
        {**good, "number": True},
        {**good, "title": None},
        {**good, "headRefOid": ""},
        {**good, "headRefName": 5},
        {**good, "url": ""},
    ]
    fake_gh(bin_dir, [*broken, good])

    pulls = await GhPrSource().open_prs(str(tmp_path))

    assert [p.number for p in pulls] == [7]


@pytest.mark.parametrize(
    ("limit", "expected"),
    [
        (len(DIFF_OF_7) - 1, DIFF_OF_7[:-1]),
        (len(DIFF_OF_7), DIFF_OF_7),
        (len(DIFF_OF_7) + 1, DIFF_OF_7),
    ],
)
async def test_a_huge_diff_is_cut(
    bin_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, limit: int, expected: str
) -> None:
    fake_gh(bin_dir, LISTING)
    monkeypatch.setattr(gh_cli, "MAX_DIFF_CHARS", limit)

    assert await GhPrSource().pr_diff(str(tmp_path), 7) == expected


@QUERIES
async def test_gh_not_installed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, query: Query
) -> None:
    monkeypatch.setenv("PATH", str(tmp_path / "vacio"))

    with pytest.raises(GithubUnavailable, match="no está instalado"):
        await query(GhPrSource(), str(tmp_path))


@QUERIES
async def test_gh_without_a_session(bin_dir: Path, tmp_path: Path, query: Query) -> None:
    fake_gh(
        bin_dir, exit_code=4, stderr="To get started with GitHub CLI, please run: gh auth login"
    )

    with pytest.raises(GithubUnavailable, match="gh auth login"):
        await query(GhPrSource(), str(tmp_path))


@QUERIES
async def test_any_other_gh_failure(bin_dir: Path, tmp_path: Path, query: Query) -> None:
    fake_gh(bin_dir, exit_code=1, stderr="HTTP 500")

    with pytest.raises(GithubUnavailable, match="no pudo consultar"):
        await query(GhPrSource(), str(tmp_path))


@pytest.mark.parametrize("raw", ["esto no es json", '{"number": 1}', "42"])
async def test_an_answer_that_is_not_a_list_of_prs(bin_dir: Path, tmp_path: Path, raw: str) -> None:
    fake_gh(bin_dir, raw_listing=raw)

    with pytest.raises(GithubUnavailable):
        await GhPrSource().open_prs(str(tmp_path))


@QUERIES
async def test_a_gh_that_hangs_is_cut_off(bin_dir: Path, tmp_path: Path, query: Query) -> None:
    fake_gh(bin_dir, sleep=30)

    with pytest.raises(GithubUnavailable, match="a tiempo"):
        await query(GhPrSource(timeout=0.3), str(tmp_path))


def _cut_gh_output_at(monkeypatch: pytest.MonkeyPatch, max_bytes: int) -> None:
    monkeypatch.setattr(gh_cli, "run_command", partial(run_command, max_output_bytes=max_bytes))


async def test_a_truncated_diff_of_a_gh_that_ended_well_is_still_a_diff(
    bin_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_gh(bin_dir, LISTING)
    _cut_gh_output_at(monkeypatch, 4)
    monkeypatch.setattr(gh_cli, "MAX_DIFF_CHARS", 3)

    assert await GhPrSource().pr_diff(str(tmp_path), 7) == "dif"


async def test_a_truncated_listing_is_not_valid_json_and_gh_is_unavailable(
    bin_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_gh(bin_dir, LISTING)
    _cut_gh_output_at(monkeypatch, 20)

    with pytest.raises(GithubUnavailable, match="no es JSON"):
        await GhPrSource().open_prs(str(tmp_path))
