"""Add unified parsing locations and note-to-source mappings."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b7c2e1f5a901"
down_revision = "a06cd2d44ded"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("materials", sa.Column("parser_version", sa.String(length=80), nullable=True))
    op.add_column("materials", sa.Column("document_warning", sa.Text(), nullable=True))
    op.add_column("material_pages", sa.Column("location_type", sa.String(length=30), nullable=True))
    op.add_column("material_pages", sa.Column("location_label", sa.String(length=500), nullable=True))
    op.add_column("material_pages", sa.Column("stable_location_key", sa.String(length=300), nullable=True))
    op.add_column("material_pages", sa.Column("extraction_method", sa.String(length=40), nullable=True))
    op.add_column("material_pages", sa.Column("confidence", sa.Float(), nullable=True))
    op.add_column("page_blocks", sa.Column("object_id", sa.String(length=200), nullable=True))
    op.add_column("page_blocks", sa.Column("location_label", sa.String(length=500), nullable=True))
    op.add_column("page_blocks", sa.Column("extraction_method", sa.String(length=40), nullable=True))
    op.add_column("page_blocks", sa.Column("confidence", sa.Float(), nullable=True))
    op.add_column("page_blocks", sa.Column("warning", sa.Text(), nullable=True))
    op.add_column("source_refs", sa.Column("status", sa.String(length=30), nullable=True))
    op.add_column("source_refs", sa.Column("target_label", sa.String(length=500), nullable=True))
    op.add_column("source_refs", sa.Column("parser_version", sa.String(length=80), nullable=True))
    op.execute(sa.text("UPDATE material_pages SET location_type='page', extraction_method='native_text' WHERE location_type IS NULL"))
    op.execute(sa.text("UPDATE page_blocks SET extraction_method='native_text' WHERE extraction_method IS NULL"))
    op.execute(sa.text("UPDATE source_refs SET status='active' WHERE status IS NULL"))
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_index("material_pages", "ix_material_pages_stable_location"):
        op.create_index("ix_material_pages_stable_location", "material_pages", ["material_id", "stable_location_key"])
    if not inspector.has_index("source_refs", "ix_source_refs_status"):
        op.create_index("ix_source_refs_status", "source_refs", ["status"])
    if not inspector.has_table("note_source_mappings"):
        op.create_table(
            "note_source_mappings",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("note_id", sa.String(length=36), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("source_ref_id", sa.String(length=36), sa.ForeignKey("source_refs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("fragment_key", sa.String(length=200), nullable=False),
            sa.Column("citation_type", sa.String(length=40), nullable=False, server_default="whole_note"),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
            sa.Column("parser_version", sa.String(length=80), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    if not inspector.has_index("note_source_mappings", "ix_note_source_mappings_note_id"):
        op.create_index("ix_note_source_mappings_note_id", "note_source_mappings", ["note_id"])


def downgrade() -> None:
    op.drop_index("ix_note_source_mappings_note_id", table_name="note_source_mappings")
    op.drop_table("note_source_mappings")
    op.drop_index("ix_source_refs_status", table_name="source_refs")
    op.drop_index("ix_material_pages_stable_location", table_name="material_pages")
    for table, columns in {
        "source_refs": ("parser_version", "target_label", "status"),
        "page_blocks": ("warning", "confidence", "extraction_method", "location_label", "object_id"),
        "material_pages": ("confidence", "extraction_method", "stable_location_key", "location_label", "location_type"),
        "materials": ("document_warning", "parser_version"),
    }.items():
        for column in columns:
            op.drop_column(table, column)
