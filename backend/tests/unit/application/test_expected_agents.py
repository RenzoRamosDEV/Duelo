"""Reviews esperadas fijadas por run: se guardan al crear el change y mandan sobre la selección
actual del proyecto al calcular su estado."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from duelo.application.ingest_commit import ChangeSubmission, ingest_commit, ingest_pr
from duelo.application.project_agents import expected_agents_of
from duelo.application.queries import get_change_detail, list_changes
from duelo.application.retry_review import RetryNotAllowed, retry_review
from duelo.domain.change import Change, ChangeKind
from duelo.domain.events import ReviewCompleted, ReviewFailed
from duelo.domain.project import Project
from duelo.domain.review import Review, ReviewResult
from duelo.domain.review_status import ChangeReviewStatus
from tests.fakes.change_repository import FakeChangeRepository
from tests.fakes.project_repository import FakeProjectRepository
from tests.fakes.review_repository import FakeReviewRepository
from tests.fakes.review_starter import FakeReviewStarter

CONFIGURED = ("claude", "codex")


def _project(agents: tuple[str, ...]) -> Project:
    return Project(id=uuid4(), slug="acme/widgets", agents=agents)


def _submission() -> ChangeSubmission:
    return ChangeSubmission(
        project="acme/widgets",
        ref="refs/heads/main",
        head_sha="a" * 40,
        title="fix: algo",
        author="renzo",
        url="",
        diff="diff --git a/x b/x",
    )


@pytest.mark.parametrize("ingest", [ingest_commit, ingest_pr])
@pytest.mark.parametrize(
    ("selection", "configured", "expected"),
    [
        (("codex",), CONFIGURED, 1),  # la selección del proyecto manda sobre los configurados
        ((), CONFIGURED, 2),  # sin selección: los configurados
        ((), (), None),  # sin ninguno de los dos: no se sabe, se calculará al leer
    ],
)
async def test_the_change_is_born_with_the_agents_of_its_first_run(
    ingest: object,
    selection: tuple[str, ...],
    configured: tuple[str, ...],
    expected: int | None,
) -> None:
    projects = FakeProjectRepository(_project(selection))

    result = await ingest(  # type: ignore[operator]
        projects,
        FakeChangeRepository(),
        FakeReviewStarter(),
        _submission(),
        max_diff_chars=100,
        agent_names=configured,
    )

    assert result.change.expected_agents == expected


async def test_reingesting_does_not_change_the_saved_expected_agents() -> None:
    project = _project(("claude",))
    changes, starter = FakeChangeRepository(), FakeReviewStarter()
    first = await ingest_commit(
        FakeProjectRepository(project),
        changes,
        starter,
        _submission(),
        max_diff_chars=100,
        agent_names=CONFIGURED,
    )

    again = await ingest_commit(
        FakeProjectRepository(replace(project, agents=CONFIGURED)),
        changes,
        starter,
        _submission(),
        max_diff_chars=100,
        agent_names=CONFIGURED,
    )

    assert (again.created, again.change.expected_agents) == (False, 1)
    assert first.change.expected_agents == 1


def _change(project: Project, expected_agents: int | None) -> Change:
    change = Change.new(
        project_id=project.id,
        kind=ChangeKind.COMMIT,
        ref="main",
        head_sha="a" * 40,
        title="t",
        author="a",
        url="",
        diff="",
        diff_truncated=False,
        created_at=datetime.now(UTC),
    )
    return replace(change, expected_agents=expected_agents)


@pytest.mark.parametrize(
    ("saved", "selection", "expected"),
    [
        (1, CONFIGURED, 1),  # lo guardado manda aunque la selección haya crecido
        (2, ("claude",), 2),  # ... y aunque haya menguado
        (None, ("claude",), 1),  # sin guardar: la selección actual
        (None, (), 3),  # sin guardar ni selección: los configurados
    ],
)
async def test_expected_agents_of_prefers_what_the_change_saved(
    saved: int | None, selection: tuple[str, ...], expected: int
) -> None:
    project = _project(selection)

    got = await expected_agents_of(
        _change(project, saved), FakeProjectRepository(project), fallback=3
    )

    assert got == expected


async def test_expected_agents_of_without_projects_uses_the_fallback() -> None:
    project = _project(())

    assert await expected_agents_of(_change(project, None), None, fallback=2) == 2
    assert await expected_agents_of(_change(project, 1), None, fallback=2) == 1


# --- «Cambio de agentes tras revisar» y «El reintento fija la nueva selección» ----------------

T0 = datetime(2026, 1, 1, tzinfo=UTC)
_CLOCK = {"now": T0, "stale_after": timedelta(hours=1)}


async def _reviewed_change(
    *, fail: bool
) -> tuple[Project, FakeChangeRepository, FakeReviewRepository, Change]:
    """Un change del proyecto de un solo agente, revisado por ese agente en su run 1, cuya
    selección pasa después a los dos agentes."""
    project = _project(("claude",))
    reviews = FakeReviewRepository()
    changes = FakeChangeRepository(reviews)
    change = (
        await ingest_commit(
            FakeProjectRepository(project),
            changes,
            FakeReviewStarter(),
            _submission(),
            max_diff_chars=100,
            agent_names=CONFIGURED,
        )
    ).change
    ids = {"change_id": change.id, "agent": "claude", "run": 1, "created_at": T0}
    if fail:
        review = Review.failed(error="boom", duration_ms=None, **ids)
        event: ReviewFailed | ReviewCompleted = ReviewFailed(
            review_id=review.id,
            change_id=change.id,
            project_id=project.id,
            agent="claude",
            error="boom",
        )
    else:
        review = Review.succeeded(
            result=ReviewResult(summary="ok", score=8), raw_output=None, duration_ms=1, **ids
        )
        event = ReviewCompleted(
            review_id=review.id, change_id=change.id, project_id=project.id, agent="claude"
        )
    await reviews.add(review, event)
    return replace(project, agents=CONFIGURED), changes, reviews, change


async def test_a_reviewed_change_stays_completed_when_the_selection_grows() -> None:
    project, changes, reviews, change = await _reviewed_change(fail=False)
    projects = FakeProjectRepository(project)

    detail = await get_change_detail(
        changes, reviews, change.id, expected_agents=2, project_agents=projects, **_CLOCK
    )
    page = await list_changes(
        projects,
        changes,
        slug=project.slug,
        kind=None,
        status=frozenset({ChangeReviewStatus.COMPLETED}),
        q=None,
        expected_agents=2,
        limit=10,
        after=None,
        **_CLOCK,
    )
    with pytest.raises(RetryNotAllowed) as error:
        await retry_review(
            changes,
            reviews,
            FakeReviewStarter(),
            change.id,
            expected_agents=2,
            now=T0,
            project_agents=projects,
        )

    assert detail is not None and detail.review_status is ChangeReviewStatus.COMPLETED
    assert [(c.id, c.review_status) for c in page.items] == [
        (change.id, ChangeReviewStatus.COMPLETED)
    ]
    assert error.value.status is ChangeReviewStatus.COMPLETED


async def test_retrying_saves_the_selection_of_the_new_run() -> None:
    project, changes, reviews, change = await _reviewed_change(fail=True)

    retried = await retry_review(
        changes,
        reviews,
        FakeReviewStarter(),
        change.id,
        expected_agents=3,
        now=T0,
        project_agents=FakeProjectRepository(project),
    )

    assert (retried.run, retried.expected_agents) == (2, 2)
    assert (await changes.get(change.id)) == retried


async def test_retrying_without_a_known_selection_saves_the_configured_agents() -> None:
    _, changes, reviews, change = await _reviewed_change(fail=True)

    retried = await retry_review(
        changes, reviews, FakeReviewStarter(), change.id, expected_agents=3, now=T0
    )

    assert (retried.run, retried.expected_agents) == (2, 3)


async def test_a_change_without_saved_agents_follows_the_current_selection() -> None:
    project, changes, reviews, change = await _reviewed_change(fail=False)
    changes._store(replace(change, expected_agents=None))  # un change de antes de guardarlo
    projects = FakeProjectRepository(project)

    detail = await get_change_detail(
        changes, reviews, change.id, expected_agents=1, project_agents=projects, **_CLOCK
    )
    page = await list_changes(
        projects,
        changes,
        slug=project.slug,
        kind=None,
        status=None,
        q=None,
        expected_agents=1,
        limit=10,
        after=None,
        **_CLOCK,
    )

    assert detail is not None and detail.review_status is ChangeReviewStatus.RUNNING
    assert [c.review_status for c in page.items] == [ChangeReviewStatus.RUNNING]
