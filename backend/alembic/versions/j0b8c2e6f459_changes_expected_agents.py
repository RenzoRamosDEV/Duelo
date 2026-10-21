"""changes.expected_agents: reviews esperadas fijadas por run

Revision ID: j0b8c2e6f459
Revises: i9f7a1d5e348
Create Date: 2026-10-21 12:00:00.000000

Aplicar sin runs en curso (worker parado y cola vacía): el relleno cuenta las reviews que ya
tiene el run actual, así que un change con el run a medias quedaría esperando menos agentes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j0b8c2e6f459"
down_revision: str | None = "i9f7a1d5e348"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("changes", sa.Column("expected_agents", sa.Integer(), nullable=True))
    # Agentes distintos con review en el run actual; sin ninguna, `NULL` (se calcula como antes).
    op.execute(
        """
        UPDATE changes c SET expected_agents = sub.n
        FROM (
            SELECT r.change_id, count(DISTINCT r.agent) AS n
            FROM reviews r JOIN changes c2 ON c2.id = r.change_id AND r.run = c2.run
            GROUP BY r.change_id
        ) sub
        WHERE sub.change_id = c.id
        """
    )


def downgrade() -> None:
    op.drop_column("changes", "expected_agents")
