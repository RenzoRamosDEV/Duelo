"""La nota de git de un change: el JSON con las reviews de una run, sin la salida cruda.

Lógica pura: quien la escribe en el repositorio es el puerto `ReviewArchive`."""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import datetime

from duelo.domain.change import Change
from duelo.domain.review import Review

NOTE_SCHEMA = 1
# Referencia de notas de git donde viven las reviews (`git notes --ref=duelo show <sha>`).
NOTES_REF = "duelo"


def render_review_note(
    change: Change, reviews: Iterable[Review], *, project: str, run: int, written_at: datetime
) -> str:
    """JSON de la nota: el change, la run y sus reviews. `raw_output` nunca va: puede ser grande
    y traer lo que el CLI imprimiera. Solo entran las reviews de `run`."""
    if written_at.tzinfo is None:
        raise ValueError("written_at debe llevar zona horaria")
    document = {
        "schema": NOTE_SCHEMA,
        "project": project,
        "sha": change.head_sha,
        "kind": change.kind.value,
        "title": change.title,
        "run": run,
        "written_at": written_at.isoformat(),
        "reviews": [_review_entry(review) for review in reviews if review.run == run],
    }
    return json.dumps(document, ensure_ascii=False, indent=2) + "\n"


def _review_entry(review: Review) -> dict[str, object]:
    return {
        "agent": review.agent,
        "status": review.status.value,
        "score": review.score,
        "summary": review.summary,
        "findings": [
            {
                "severity": finding.severity,
                "file": finding.file,
                "line": finding.line,
                "message": finding.message,
            }
            for finding in review.findings
        ],
        "duration_ms": review.duration_ms,
        "error": review.error,
        "created_at": review.created_at.isoformat(),
    }
