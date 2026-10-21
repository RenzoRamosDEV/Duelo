"""La URL de la base de datos: la exige `create_engine` y las migraciones la leen de la
configuración del worker (12-factor: `DATABASE_URL` manda)."""

from __future__ import annotations

import contextlib
import logging.config
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


def test_the_migration_logging_config_does_not_silence_the_existing_loggers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regresión: `fileConfig` desactiva por defecto los loggers ya creados, y una migración
    lanzada desde los tests dejaba mudos los de la aplicación para el resto de la sesión."""
    calls: list[tuple[object, dict[str, object]]] = []
    monkeypatch.setattr(
        logging.config, "fileConfig", lambda *args, **kwargs: calls.append((args[0], kwargs))
    )
    fake_context = SimpleNamespace(
        config=SimpleNamespace(config_file_name="alembic.ini"),
        is_offline_mode=lambda: True,
        configure=lambda **kwargs: None,
        begin_transaction=contextlib.nullcontext,
        run_migrations=lambda: None,
    )
    monkeypatch.setattr(alembic, "context", fake_context)

    runpy.run_path(str(ENV_PY))

    assert calls == [("alembic.ini", {"disable_existing_loggers": False})]
