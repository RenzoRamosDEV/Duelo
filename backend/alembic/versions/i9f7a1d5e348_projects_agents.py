"""projects.agents: agentes elegidos para evaluar cada proyecto

Revision ID: i9f7a1d5e348
Revises: h8e6f0c4d237
Create Date: 2026-10-11 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "i9f7a1d5e348"
down_revision: str | None = "h8e6f0c4d237"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `NULL` = todos los agentes disponibles: los proyectos existentes no cambian de comportamiento.
    op.add_column(
        "projects", sa.Column("agents", postgresql.ARRAY(sa.String(length=64)), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("projects", "agents")
