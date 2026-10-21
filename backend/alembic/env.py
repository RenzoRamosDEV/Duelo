from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from duelo.adapters.persistence.models import Base
from duelo.config import WorkerSettings

config = context.config

if config.config_file_name is not None:
    # Sin `disable_existing_loggers=False`, una migración lanzada dentro de un proceso (los tests,
    # `command.upgrade`) silencia los loggers de la aplicación que ya existían.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Las migraciones se escriben a mano (no se usa `alembic revision --autogenerate`);
# target_metadata solo habilita `alembic check` como red de seguridad extra.
target_metadata = Base.metadata


def get_url() -> str:
    # `WorkerSettings` y no `Settings`: una migración no necesita (ni tiene) el `INGEST_TOKEN`
    # que exige la API, y la URL sigue las mismas reglas que en la API y el worker.
    return WorkerSettings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
