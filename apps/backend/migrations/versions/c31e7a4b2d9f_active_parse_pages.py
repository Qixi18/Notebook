"""Track the active page version during a material reparse."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c31e7a4b2d9f"
down_revision = "b7c2e1f5a901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("material_pages", sa.Column("is_active", sa.Boolean(), nullable=True))
    op.execute(sa.text("UPDATE material_pages SET is_active=1 WHERE is_active IS NULL"))


def downgrade() -> None:
    op.drop_column("material_pages", "is_active")
