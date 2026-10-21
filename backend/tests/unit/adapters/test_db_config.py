"""La URL de la base de datos: la exige `create_engine` y las migraciones la leen de la
configuración del worker (12-factor: `DATABASE_URL` manda)."""

from __future__ import annotations

import contextlib
import runpy
from pathlib import Path
from types import SimpleNamespace

import alembic
import pytest

from duelo.adapters.persistence.db import create_engine

ENV_PY = Path(__file__).resolve().parents[3] / "alembic" / "env.py"


def test_create_engine_requires_the_url() -> None:
    with pytest.raises(TypeError):
        create_engine()  # type: ignore[call-arg]


def test_create_engine_uses_the_given_url() -> None:
    engine = create_engine("postgresql+asyncpg://u:p@host-explicito:5434/db")

    assert (engine.url.host, engine.url.port) == ("host-explicito", 5434)


@pytest.mark.parametrize("variable", ["DATABASE_URL", "database_url"])
def test_the_migrations_read_the_url_of_the_worker_settings_without_an_ingest_token(
    monkeypatch: pytest.MonkeyPatch, variable: str
) -> None:
    """`env.py` en modo offline con un `alembic.context` falso: la URL con la que se configura
    sigue las reglas de `WorkerSettings` (como la API y el worker), también sin distinguir
    mayúsculas en el nombre de la variable."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv(variable, "postgresql+asyncpg://u:p@host-migracion:5435/db")
    monkeypatch.delenv("INGEST_TOKEN", raising=False)
    configured: dict[str, object] = {}
    fake_context = SimpleNamespace(
        config=SimpleNamespace(config_file_name=None),
        is_offline_mode=lambda: True,
        configure=lambda **kwargs: configured.update(kwargs),
        begin_transaction=contextlib.nullcontext,
        run_migrations=lambda: None,
    )
    monkeypatch.setattr(alembic, "context", fake_context)

    runpy.run_path(str(ENV_PY))

    assert configured["url"] == "postgresql+asyncpg://u:p@host-migracion:5435/db"
