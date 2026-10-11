from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
import pytest

from duelo.domain.change import Change, ChangeKind
from duelo.domain.events import ChangeCreated, ReviewCompleted, ReviewFailed
from duelo.domain.review import Review, ReviewResult
from tests.fakes.api import TOKEN, FakeApi, build_fake_api

HEADERS = {"X-Ingest-Token": TOKEN}
NOW = datetime(2026, 1, 1, tzinfo=UTC)


def _client(api: FakeApi) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=api.app, raise_app_exceptions=False),
        base_url="http://test",
    )


def _api() -> FakeApi:
    return build_fake_api(agent_names=["claude", "codex"])


async def _put(api: FakeApi, agents: Any, *, headers: dict[str, str] | None = HEADERS):
    async with _client(api) as client:
        return await client.put(
            f"/projects/{api.project.slug}/agents", json={"agents": agents}, headers=headers
        )


async def _agents_listed(api: FakeApi) -> list[str]:
    async with _client(api) as client:
        return (await client.get("/projects")).json()[0]["agents"]


async def _change_reviewed_by(api: FakeApi, *outcomes: tuple[str, bool]) -> Change:
    """Un commit con una review por `(agente, falla)`."""
    change = Change.new(
        project_id=api.project.id,
        kind=ChangeKind.COMMIT,
        ref="r",
        head_sha="e" * 40,
        title="t",
        author="a",
        url="u",
        diff="d",
        diff_truncated=False,
        created_at=NOW,
    )
    await api.changes.add(
        change,
        ChangeCreated(
            change_id=change.id, project_id=api.project.id, kind="commit", head_sha=change.head_sha
        ),
    )
    for agent, fails in outcomes:
        ids = {"change_id": change.id, "project_id": api.project.id, "agent": agent}
        common = {"change_id": change.id, "agent": agent, "run": 1, "created_at": NOW}
        if fails:
            review = Review.failed(error="boom", duration_ms=None, **common)
            await api.reviews.add(review, ReviewFailed(review_id=review.id, error="boom", **ids))
        else:
            review = Review.succeeded(
                result=ReviewResult(summary="ok", score=1), duration_ms=1, raw_output=None, **common
            )
            await api.reviews.add(review, ReviewCompleted(review_id=review.id, **ids))
    return change


async def test_without_a_saved_selection_every_available_agent_reviews() -> None:
    assert await _agents_listed(_api()) == ["claude", "codex"]


async def test_saving_a_selection_returns_the_project_and_the_list_keeps_it() -> None:
    api = _api()

    response = await _put(api, ["codex"])

    assert response.status_code == 200
    assert response.json()["agents"] == ["codex"]
    assert await _agents_listed(api) == ["codex"]


@pytest.mark.parametrize(
    "agents",
    [[], ["claude", "claude"], ["gemini"], ["claude", "gemini"], [""], "claude"],
)
async def test_an_invalid_selection_is_422_and_keeps_the_previous_one(agents: Any) -> None:
    api = _api()
    await _put(api, ["codex"])

    response = await _put(api, agents)

    assert response.status_code == 422
    assert await _agents_listed(api) == ["codex"]


async def test_changing_the_selection_needs_the_ingest_token() -> None:
    api = _api()

    missing = await _put(api, ["codex"], headers=None)
    wrong = await _put(api, ["codex"], headers={"X-Ingest-Token": "no"})

    assert (missing.status_code, wrong.status_code) == (401, 401)
    assert await _agents_listed(api) == ["claude", "codex"]


async def test_an_unknown_project_is_404() -> None:
    api = _api()
    async with _client(api) as client:
        response = await client.put(
            "/projects/nadie/nada/agents", json={"agents": ["codex"]}, headers=HEADERS
        )
    assert response.status_code == 404


async def test_it_works_even_when_local_projects_are_disabled() -> None:
    api = build_fake_api(agent_names=["claude", "codex"], local_projects=False)
    assert (await _put(api, ["claude"])).status_code == 200


async def test_the_only_chosen_agent_completes_the_change() -> None:
    api = _api()
    await _put(api, ["codex"])
    change = await _change_reviewed_by(api, ("codex", False))

    async with _client(api) as client:
        detail = (await client.get(f"/changes/{change.id}")).json()
        listed = (await client.get(f"/projects/{api.project.slug}/changes")).json()

    assert detail["review_status"] == "completed"
    assert listed["items"][0]["review_status"] == "completed"


async def test_with_both_agents_one_review_is_still_running() -> None:
    api = _api()
    change = await _change_reviewed_by(api, ("codex", False))

    async with _client(api) as client:
        detail = (await client.get(f"/changes/{change.id}")).json()

    assert detail["review_status"] == "running"


async def test_the_failed_only_agent_can_be_retried() -> None:
    api = _api()
    await _put(api, ["claude"])
    change = await _change_reviewed_by(api, ("claude", True))

    async with _client(api) as client:
        response = await client.post(f"/changes/{change.id}/retry", headers=HEADERS)

    assert response.status_code == 202
    assert api.starter.calls == 1


async def test_changing_the_selection_keeps_the_existing_reviews_and_status() -> None:
    api = _api()
    change = await _change_reviewed_by(api, ("claude", False), ("codex", False))

    await _put(api, ["claude"])

    async with _client(api) as client:
        detail = (await client.get(f"/changes/{change.id}")).json()
    assert detail["review_status"] == "completed"
    assert sorted(r["agent"] for r in detail["reviews"]) == ["claude", "codex"]
