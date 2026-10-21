"""events.project_id: índice para el borrado en cascada de un proyecto

Revision ID: k1c9d3f7a560
Revises: j0b8c2e6f459
Create Date: 2026-10-21 23:00:00.000000

Sin `CONCURRENTLY`: la tabla es de un solo usuario y el bloqueo dura lo que tarda en construirse.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "k1c9d3f7a560"
down_revision: str | None = "j0b8c2e6f459"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_events_project_id", "events", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_events_project_id", table_name="events")
