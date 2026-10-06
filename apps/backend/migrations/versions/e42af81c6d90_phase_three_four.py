"""Persist phase three conversations/proposals and phase four feedback/backups."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e42af81c6d90"
down_revision = "c31e7a4b2d9f"
branch_labels = None
depends_on = None


def _common_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "conversations",
        *_common_columns()[:1],
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("default_scope", sa.String(length=30), nullable=False),
        _common_columns()[1],
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_conversations_course_id", "conversations", ["course_id"])

    op.create_table(
        "conversation_messages",
        *_common_columns()[:1],
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("learning_goal", sa.String(length=60), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("model_version", sa.String(length=120), nullable=True),
        sa.Column("failure_type", sa.String(length=60), nullable=True),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        _common_columns()[1],
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("conversation_id", "idempotency_key", name="uq_message_idempotency"),
    )
    op.create_index("ix_conversation_messages_conversation_id", "conversation_messages", ["conversation_id"])

    op.create_table(
        "message_evidence",
        *_common_columns()[:1],
        sa.Column("message_id", sa.String(length=36), nullable=False),
        sa.Column("source_ref_id", sa.String(length=36), nullable=True),
        sa.Column("web_source_id", sa.String(length=36), nullable=True),
        sa.Column("claim_key", sa.String(length=200), nullable=False),
        sa.Column("evidence_type", sa.String(length=40), nullable=False),
        sa.Column("support_level", sa.String(length=30), nullable=False),
        _common_columns()[1],
        sa.ForeignKeyConstraint(["message_id"], ["conversation_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_ref_id"], ["source_refs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["web_source_id"], ["web_sources.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_message_evidence_message_id", "message_evidence", ["message_id"])

    op.create_table(
        "knowledge_proposals",
        *_common_columns()[:1],
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("material_id", sa.String(length=36), nullable=True),
        sa.Column("source_node_id", sa.String(length=36), nullable=True),
        sa.Column("target_node_id", sa.String(length=36), nullable=True),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("candidate_name", sa.String(length=300), nullable=False),
        sa.Column("candidate_summary", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("source_ids_json", sa.Text(), nullable=False),
        sa.Column("proposed_delta_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("model_version", sa.String(length=120), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        _common_columns()[1],
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_node_id"], ["knowledge_nodes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_node_id"], ["knowledge_nodes.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_knowledge_proposals_course_status", "knowledge_proposals", ["course_id", "status"])

    op.create_table(
        "knowledge_changes",
        *_common_columns()[:1],
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("proposal_id", sa.String(length=36), nullable=True),
        sa.Column("node_id", sa.String(length=36), nullable=True),
        sa.Column("change_type", sa.String(length=30), nullable=False),
        sa.Column("before_json", sa.Text(), nullable=False),
        sa.Column("after_json", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        _common_columns()[1],
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["proposal_id"], ["knowledge_proposals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["node_id"], ["knowledge_nodes.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_knowledge_changes_course_id", "knowledge_changes", ["course_id"])

    op.create_table(
        "note_suggestions",
        *_common_columns()[:1],
        sa.Column("note_id", sa.String(length=36), nullable=False),
        sa.Column("proposed_markdown", sa.Text(), nullable=False),
        sa.Column("source_ids_json", sa.Text(), nullable=False),
        sa.Column("impact", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        _common_columns()[1],
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_note_suggestions_note_status", "note_suggestions", ["note_id", "status"])

    op.create_table(
        "feedback",
        *_common_columns()[:1],
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("target_type", sa.String(length=40), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("resolution", sa.Text(), nullable=True),
        _common_columns()[1],
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("course_id", "target_type", "target_id", "category", name="uq_feedback_target"),
    )
    op.create_index("ix_feedback_course_status", "feedback", ["course_id", "status"])

    op.create_table(
        "backup_records",
        *_common_columns()[:1],
        sa.Column("course_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("path", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("manifest_json", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        _common_columns()[1],
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_backup_records_course_id", "backup_records", ["course_id"])


def downgrade() -> None:
    for index, table in (
        ("ix_backup_records_course_id", "backup_records"),
        ("ix_feedback_course_status", "feedback"),
        ("ix_note_suggestions_note_status", "note_suggestions"),
        ("ix_knowledge_changes_course_id", "knowledge_changes"),
        ("ix_knowledge_proposals_course_status", "knowledge_proposals"),
        ("ix_message_evidence_message_id", "message_evidence"),
        ("ix_conversation_messages_conversation_id", "conversation_messages"),
        ("ix_conversations_course_id", "conversations"),
    ):
        op.drop_index(index, table_name=table)
    for table in (
        "backup_records", "feedback", "note_suggestions", "knowledge_changes",
        "knowledge_proposals", "message_evidence", "conversation_messages", "conversations",
    ):
        op.drop_table(table)
