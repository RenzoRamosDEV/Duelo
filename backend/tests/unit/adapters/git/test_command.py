"""`run_git`: el único punto por el que los adaptadores invocan `git` sobre un proyecto."""

from __future__ import annotations

import os
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass, field

import pytest

from duelo.adapters.git import command
from duelo.adapters.subprocess_runner import CommandResult

REPO = "/home/u/widgets"
REDIRECTING = {"GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"}


@dataclass
class RunCommandSpy:
    """Hace de `run_command`: anota cada llamada y responde con éxito."""

    calls: list[dict[str, object]] = field(default_factory=list)

    async def __call__(
        self,
        argv: Sequence[str],
        *,
        timeout: float,
        env: Mapping[str, str] | None = None,
        exclude_env: Collection[str] = (),
    ) -> CommandResult:
        self.calls.append(
            {"argv": list(argv), "timeout": timeout, "env": dict(env or {}), "exclude": exclude_env}
        )
        return CommandResult(0, "salida", "")


@pytest.fixture
def spy(monkeypatch: pytest.MonkeyPatch) -> RunCommandSpy:
    recorder = RunCommandSpy()
    monkeypatch.setattr(command, "run_command", recorder)
    return recorder


async def test_by_default_git_runs_isolated_without_hooks_nor_fsmonitor(
    spy: RunCommandSpy,
) -> None:
    result = await command.run_git(REPO, "rev-parse", "HEAD", timeout=3.0)

    ((call,),) = [spy.calls]
    assert result.stdout == "salida"
    assert call["argv"] == [
        "git",
        "-c",
        "core.fsmonitor=false",
        "-c",
        f"core.hooksPath={os.devnull}",
        "-C",
        REPO,
        "rev-parse",
        "HEAD",
    ]
    assert call["timeout"] == 3.0
    assert call["env"] == {"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull}
    assert set(call["exclude"]) == REDIRECTING  # type: ignore[call-overload]


async def test_the_hooks_dir_query_can_read_core_hooks_path_as_is(spy: RunCommandSpy) -> None:
    await command.run_git(REPO, "rev-parse", disable_hooks=False)

    argv = spy.calls[0]["argv"]
    assert argv == ["git", "-c", "core.fsmonitor=false", "-C", REPO, "rev-parse"]


async def test_the_user_config_can_be_kept_but_never_the_system_one(spy: RunCommandSpy) -> None:
    await command.run_git(REPO, "notes", isolate_user_config=False)

    (call,) = spy.calls
    assert call["env"] == {"GIT_CONFIG_NOSYSTEM": "1"}
    assert set(call["exclude"]) == REDIRECTING  # type: ignore[call-overload]


async def test_extra_env_is_merged_with_the_hardening(spy: RunCommandSpy) -> None:
    await command.run_git(REPO, "push", env={"GIT_SSH_COMMAND": "ssh -o BatchMode=yes"})

    assert spy.calls[0]["env"] == {
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_SSH_COMMAND": "ssh -o BatchMode=yes",
    }


async def test_the_default_timeout_is_the_one_of_run_command(spy: RunCommandSpy) -> None:
    await command.run_git(REPO, "status")

    assert spy.calls[0]["timeout"] == 10.0
