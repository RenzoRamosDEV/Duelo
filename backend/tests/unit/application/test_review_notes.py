"""La nota de git de un change: contenido, solo la run pedida, sin salida cruda."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from duelo.application.review_notes import NOTE_SCHEMA, render_review_note
from duelo.domain.change import Change, ChangeKind
from duelo.domain.review import Finding, Review, ReviewStatus

WHEN = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)


def _change() -> Change:
    return Change.new(
        project_id=uuid4(),
        kind=ChangeKind.COMMIT,
        ref="refs/heads/main",
        head_sha="c" * 40,
        title="feat: notas",
        author="renzo",
        url="https://example.com",
        diff="diff --git a/x b/x",
        diff_truncated=False,
        created_at=WHEN,
    )


def _review(change: Change, agent: str, *, run: int = 1, failed: bool = False) -> Review:
    return Review(
        id=uuid4(),
        change_id=change.id,
        agent=agent,
        run=run,
        status=ReviewStatus.FAILED if failed else ReviewStatus.COMPLETED,
        summary=None if failed else f"resumen de {agent}",
        score=None if failed else 8,
        findings=() if failed else (Finding("bug", "a.py", 3, "falla con 0"),),
        raw_output="SALIDA CRUDA QUE NO DEBE SALIR",
        duration_ms=1234,
        error="el CLI murió" if failed else None,
        created_at=WHEN,
    )


def test_the_note_carries_the_change_and_every_review_of_the_run() -> None:
    change = _change()
    reviews = [_review(change, "claude"), _review(change, "codex", failed=True)]

    note = json.loads(render_review_note(change, reviews, project="o/r", run=1, written_at=WHEN))

    assert note["schema"] == NOTE_SCHEMA
    assert (note["project"], note["sha"], note["kind"], note["title"], note["run"]) == (
        "o/r",
        "c" * 40,
        "commit",
        "feat: notas",
        1,
    )
    assert note["written_at"] == "2026-10-11T12:00:00+00:00"
    claude, codex = note["reviews"]
    assert (claude["agent"], claude["status"], claude["score"]) == ("claude", "completed", 8)
    assert claude["findings"] == [
        {"severity": "bug", "file": "a.py", "line": 3, "message": "falla con 0"}
    ]
    assert (codex["status"], codex["score"], codex["error"]) == ("failed", None, "el CLI murió")
    assert claude["duration_ms"] == 1234


def test_the_note_never_includes_the_raw_output() -> None:
    change = _change()

    text = render_review_note(
        change, [_review(change, "claude")], project="o/r", run=1, written_at=WHEN
    )

    assert "SALIDA CRUDA" not in text
    assert "raw_output" not in text


def test_only_the_reviews_of_the_requested_run_enter() -> None:
    change = _change()
    reviews = [_review(change, "claude", run=1), _review(change, "claude", run=2)]

    note = json.loads(render_review_note(change, reviews, project="o/r", run=2, written_at=WHEN))

    assert [r["agent"] for r in note["reviews"]] == ["claude"]
    assert note["run"] == 2


def test_a_naive_timestamp_is_rejected() -> None:
    change = _change()

    with pytest.raises(ValueError, match="zona horaria"):
        render_review_note(change, [], project="o/r", run=1, written_at=datetime(2026, 1, 1))
