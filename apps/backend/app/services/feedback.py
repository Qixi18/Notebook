"""Course-scoped, idempotent feedback records."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    ConversationMessage,
    Feedback,
    KnowledgeProposal,
    Note,
    SourceRef,
)


def target_belongs_to_course(db: Session, *, course_id: str, target_type: str, target_id: str) -> bool:
    if target_type == "assistant_message":
        message = db.get(ConversationMessage, target_id)
        return bool(message and message.conversation.course_id == course_id)
    if target_type == "note":
        note = db.get(Note, target_id)
        return bool(note and note.course_id == course_id)
    if target_type == "knowledge_proposal":
        proposal = db.get(KnowledgeProposal, target_id)
        return bool(proposal and proposal.course_id == course_id)
    if target_type == "source":
        source = db.get(SourceRef, target_id)
        return bool(source and source.page_block.page.material.course_id == course_id)
    return False


def save_feedback(
    db: Session, *, course_id: str, target_type: str, target_id: str,
    category: str, comment: str | None,
) -> Feedback:
    if not target_belongs_to_course(db, course_id=course_id, target_type=target_type, target_id=target_id):
        raise ValueError("反馈目标不属于当前课程")
    existing = db.scalar(select(Feedback).where(
        Feedback.course_id == course_id,
        Feedback.target_type == target_type,
        Feedback.target_id == target_id,
        Feedback.category == category,
    ))
    if existing is not None:
        if comment and not existing.comment:
            existing.comment = comment
        return existing
    feedback = Feedback(
        course_id=course_id, target_type=target_type, target_id=target_id,
        category=category, comment=comment,
    )
    db.add(feedback)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return db.scalar(select(Feedback).where(
            Feedback.course_id == course_id, Feedback.target_type == target_type,
            Feedback.target_id == target_id, Feedback.category == category,
        ))
    return feedback
