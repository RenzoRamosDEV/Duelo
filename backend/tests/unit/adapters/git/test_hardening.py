"""Ningún adaptador ejecuta la configuración de un repositorio ajeno ni se deja redirigir a otro:
todos invocan `git` a través de `run_git`, con repositorios reales en `tmp_path`."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from pathlib import Path

import pytest

from duelo.adapters.git import command
from duelo.adapters.git.history import LocalGitHistory
from duelo.adapters.git.hook_installer import FileHookInstaller
from duelo.adapters.git.local_repository import LocalGitRepository
from duelo.adapters.git.notes_archive import WRITTEN, GitNotesArchive
from duelo.application.ports import HookInstallError
from tests.unit.adapters.git.helpers import commit_file, git, init_repo

NOTE = '{"schema": 1, "reviews": []}\n'


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    repository = init_repo(tmp_path / "widgets")
    git(repository, "config", "user.email", "t@example.com")
    git(repository, "config", "user.name", "t")
    commit_file(repository)
    return repository


def _installer(tmp_path: Path) -> FileHookInstaller:
    return FileHookInstaller(
        python="/usr/bin/python3",
        ingest_url="http://127.0.0.1:8000",
        ingest_token="tok",
        env_path=tmp_path / "config" / "duelo" / "hook.env",
    )


def _uses(tmp_path: Path) -> dict[str, Callable[[Path], Awaitable[object]]]:
    """Cada adaptador haciendo su trabajo normal sobre `repo`."""

    async def archive(repo: Path) -> object:
        sha = git(repo, "rev-parse", "HEAD").strip()
        return await GitNotesArchive(push=False).archive(str(repo), sha, NOTE)

    async def history(repo: Path) -> object:
        return await LocalGitHistory().reachable(str(repo), limit=100)

    async def inspect(repo: Path) -> object:
        return await LocalGitRepository().inspect(str(repo))

    async def install(repo: Path) -> object:
        return await _installer(tmp_path).install(str(repo), slug="a/b")

    return {"archive": archive, "history": history, "inspect": inspect, "install": install}


@pytest.mark.parametrize("use", ["archive", "history", "inspect", "install"])
async def test_every_git_call_of_every_adapter_goes_through_run_git(
    use: str, repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[list[str]] = []
    real = command.run_command

    async def recording(argv, **kwargs):  # type: ignore[no-untyped-def]
        seen.append(list(argv))
        return await real(argv, **kwargs)

    monkeypatch.setattr(command, "run_command", recording)

    await _uses(tmp_path)[use](repo)

    assert seen, "el adaptador no pasó por run_git"
    for argv in seen:
        assert argv[:3] == ["git", "-c", "core.fsmonitor=false"]


@pytest.mark.parametrize("use", ["archive", "history", "inspect"])
async def test_a_hostile_fsmonitor_never_runs(use: str, repo: Path, tmp_path: Path) -> None:
    marker = tmp_path / "ejecutado"
    script = tmp_path / "fsmonitor.sh"
    script.write_text(f"#!/bin/sh\ntouch {marker}\n")
    script.chmod(0o755)
    git(repo, "config", "core.fsmonitor", str(script))

    await _uses(tmp_path)[use](repo)

    assert not marker.exists()


async def test_the_note_is_still_written_with_the_hardening(repo: Path, tmp_path: Path) -> None:
    outcome = await _uses(tmp_path)["archive"](repo)

    assert outcome.status == WRITTEN  # type: ignore[attr-defined]


async def test_git_dir_in_the_environment_does_not_redirect_inspect(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    other = init_repo(tmp_path / "otro", origin="git@github.com:evil/otro.git")
    monkeypatch.setenv("GIT_DIR", str(other / ".git"))

    info = await LocalGitRepository().inspect(str(repo))

    assert (info.root, info.remote_url) == (str(repo), None)


async def test_a_global_hooks_path_outside_the_repo_is_still_refused(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """El instalador conserva la configuración del usuario: un `core.hooksPath` global que
    apunta a una carpeta compartida se ve y se rechaza, como el del repo."""
    shared = tmp_path / "hooks-compartidos"
    shared.mkdir()
    gitconfig = tmp_path / "gitconfig"
    gitconfig.write_text(f"[core]\n\thooksPath = {shared}\n")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(gitconfig))

    with pytest.raises(HookInstallError, match=r"core\.hooksPath apunta fuera"):
        await _installer(tmp_path).install(str(repo), slug="a/b")

    assert list(shared.iterdir()) == []


async def test_a_hooks_path_inside_the_repo_is_still_respected(repo: Path, tmp_path: Path) -> None:
    git(repo, "config", "core.hooksPath", ".githooks")

    await _installer(tmp_path).install(str(repo), slug="a/b")

    assert (repo / ".githooks" / "post-commit").exists()
