"""`GitNotesArchive` con repositorios git reales y un remoto `bare` local: escribe la nota en
`refs/notes/duelo`, la sustituye, la empuja y nunca lanza por un fallo de git."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from duelo.adapters.git.notes_archive import FAILED, PUSHED, SKIPPED, WRITTEN, GitNotesArchive
from tests.unit.adapters.git.helpers import commit_file, git, init_repo

NOTE = '{"schema": 1, "reviews": []}\n'


def _bare(path: Path) -> str:
    subprocess.run(["git", "init", "-q", "--bare", str(path)], check=True)
    return str(path)


@pytest.fixture
def repo(tmp_path: Path) -> tuple[Path, str, str]:
    remote = _bare(tmp_path / "origin.git")
    repository = init_repo(tmp_path / "repo", origin=remote)
    git(repository, "config", "user.email", "t@example.com")
    git(repository, "config", "user.name", "t")
    return repository, commit_file(repository), remote


def _note(repository: Path, sha: str) -> str:
    return git(repository, "notes", "--ref=duelo", "show", sha)


async def test_the_note_is_written_and_pushed_to_origin(repo: tuple[Path, str, str]) -> None:
    repository, sha, remote = repo

    outcome = await GitNotesArchive(push=True).archive(str(repository), sha, NOTE)

    assert outcome.status == PUSHED
    assert _note(repository, sha) == NOTE
    refs = subprocess.run(
        ["git", "-C", remote, "ls-remote", ".", "refs/notes/duelo"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    assert "refs/notes/duelo" in refs


async def test_writing_again_replaces_the_note_instead_of_appending(
    repo: tuple[Path, str, str],
) -> None:
    repository, sha, _remote = repo
    archive = GitNotesArchive(push=False)
    await archive.archive(str(repository), sha, NOTE)

    outcome = await archive.archive(str(repository), sha, '{"run": 2}\n')

    assert outcome.status == WRITTEN
    assert _note(repository, sha) == '{"run": 2}\n'
    assert git(repository, "notes", "--ref=duelo", "list").count("\n") == 1


async def test_without_push_the_remote_is_not_touched(repo: tuple[Path, str, str]) -> None:
    repository, sha, remote = repo

    outcome = await GitNotesArchive(push=False).archive(str(repository), sha, NOTE)

    assert outcome.status == WRITTEN
    refs = subprocess.run(
        ["git", "-C", remote, "ls-remote", "."], check=True, capture_output=True, text=True
    ).stdout
    assert "refs/notes/duelo" not in refs


async def test_a_commit_missing_from_the_local_repo_is_skipped(
    repo: tuple[Path, str, str],
) -> None:
    repository, _sha, _remote = repo

    outcome = await GitNotesArchive(push=True).archive(str(repository), "f" * 40, NOTE)

    assert outcome.status == SKIPPED
    assert "no está en el repositorio local" in outcome.detail


async def test_without_origin_the_note_stays_local(tmp_path: Path) -> None:
    repository = init_repo(tmp_path / "solo")
    git(repository, "config", "user.email", "t@example.com")
    git(repository, "config", "user.name", "t")
    sha = commit_file(repository)

    outcome = await GitNotesArchive(push=True).archive(str(repository), sha, NOTE)

    assert outcome.status == WRITTEN
    assert "sin remoto origin" in outcome.detail
    assert _note(repository, sha) == NOTE


async def test_a_failed_push_keeps_the_note_and_reports_without_leaking_output(
    tmp_path: Path,
) -> None:
    # Un remoto que no existe: el push falla; el detalle no incluye la ruta ni el error de git.
    repository = init_repo(tmp_path / "repo", origin=str(tmp_path / "no-existe.git"))
    git(repository, "config", "user.email", "t@example.com")
    git(repository, "config", "user.name", "t")
    sha = commit_file(repository)

    outcome = await GitNotesArchive(push=True).archive(str(repository), sha, NOTE)

    assert outcome.status == FAILED
    assert "push" in outcome.detail
    assert str(tmp_path) not in outcome.detail
    assert _note(repository, sha) == NOTE


async def test_a_folder_that_is_not_a_repository_fails_without_raising(tmp_path: Path) -> None:
    outcome = await GitNotesArchive(push=False).archive(str(tmp_path), "a" * 40, NOTE)

    assert outcome.status == SKIPPED  # `cat-file` falla: no hay repositorio ni commit
