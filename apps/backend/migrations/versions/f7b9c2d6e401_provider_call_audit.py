"""Store redacted external provider call outcomes for phase four evidence."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "f7b9c2d6e401"
down_revision = "e42af81c6d90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "provider_calls",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("operation", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("course_id", sa.String(length=36), nullable=True),
        sa.Column("material_id", sa.String(length=36), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("request_units", sa.Integer(), nullable=True),
        sa.Column("response_units", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("error_type", sa.String(length=120), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_provider_calls_provider_created", "provider_calls", ["provider", "created_at"]
    )
    op.create_index(
        "ix_provider_calls_course_created", "provider_calls", ["course_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_provider_calls_course_created", table_name="provider_calls")
    op.drop_index("ix_provider_calls_provider_created", table_name="provider_calls")
    op.drop_table("provider_calls")
