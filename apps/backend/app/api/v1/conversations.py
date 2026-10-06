from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai.orchestrator import run_answer
from app.api.v1.shared import ensure_course
from app.db.database import get_db
from app.db.models import (
    Conversation,
    ConversationMessage,
    Material,
    MessageEvidence,
    PageBlock,
    SourceRef,
    WebSource,
)
from app.schemas.api import (
    ConversationCreate,
    ConversationMessageCreate,
    ConversationMessageRead,
    ConversationRead,
    MessageEvidenceRead,
)

router = APIRouter()


def _message_read(message: ConversationMessage) -> ConversationMessageRead:
    evidence = []
    for item in message.evidence:
        snippet = None
        location_label = None
        if item.source_ref is not None:
            snippet = item.source_ref.quote
            if item.source_ref.page_block is not None:
                location_label = item.source_ref.page_block.location_label or item.source_ref.page_block.page.location_label
        elif item.web_source is not None:
            snippet = item.web_source.snippet
        evidence.append(MessageEvidenceRead(
            id=item.id,
            claim_key=item.claim_key,
            evidence_type=item.evidence_type,
            support_level=item.support_level,
            source_ref_id=item.source_ref_id,
            web_source_id=item.web_source_id,
            snippet=snippet,
            location_label=location_label,
        ))
    return ConversationMessageRead(
        id=message.id,
        conversation_id=message.conversation_id,
        role=message.role,
        content=message.content,
        learning_goal=message.learning_goal,
        status=message.status,
        model_version=message.model_version,
        failure_type=message.failure_type,
        created_at=message.created_at,
        evidence=evidence,
    )


def _load_conversation(db: Session, conversation_id: str) -> Conversation:
    conversation = db.scalar(
        select(Conversation).where(Conversation.id == conversation_id).options(
            selectinload(Conversation.messages)
            .selectinload(ConversationMessage.evidence)
            .selectinload(MessageEvidence.source_ref)
            .selectinload(SourceRef.page_block)
            .selectinload(PageBlock.page)
        )
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    ensure_course(db, conversation.course_id)
    return conversation


@router.post("/courses/{course_id}/conversations", response_model=ConversationRead, status_code=201)
def create_conversation(course_id: str, payload: ConversationCreate, db: Session = Depends(get_db)) -> Conversation:
    ensure_course(db, course_id)
    conversation = Conversation(course_id=course_id, title=payload.title.strip(), default_scope=payload.default_scope)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/courses/{course_id}/conversations", response_model=list[ConversationRead])
def list_conversations(course_id: str, db: Session = Depends(get_db)) -> list[Conversation]:
    ensure_course(db, course_id)
    return list(db.scalars(select(Conversation).where(Conversation.course_id == course_id).order_by(Conversation.updated_at.desc())).all())


@router.get("/conversations/{conversation_id}/messages", response_model=list[ConversationMessageRead])
def list_messages(conversation_id: str, db: Session = Depends(get_db)) -> list[ConversationMessageRead]:
    _load_conversation(db, conversation_id)
    messages = list(db.scalars(
        select(ConversationMessage).where(ConversationMessage.conversation_id == conversation_id)
        .options(
            selectinload(ConversationMessage.evidence).selectinload(MessageEvidence.source_ref)
            .selectinload(SourceRef.page_block).selectinload(PageBlock.page),
            selectinload(ConversationMessage.evidence).selectinload(MessageEvidence.web_source),
        ).order_by(ConversationMessage.created_at)
    ).all())
    return [_message_read(message) for message in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=ConversationMessageRead, status_code=201)
def send_message(
    conversation_id: str,
    payload: ConversationMessageCreate,
    db: Session = Depends(get_db),
) -> ConversationMessageRead:
    conversation = _load_conversation(db, conversation_id)
    if payload.idempotency_key:
        existing = db.scalar(select(ConversationMessage).where(
            ConversationMessage.conversation_id == conversation_id,
            ConversationMessage.role == "user",
            ConversationMessage.idempotency_key == payload.idempotency_key,
        ))
        if existing is not None:
            answer = db.scalar(select(ConversationMessage).where(
                ConversationMessage.conversation_id == conversation_id,
                ConversationMessage.role == "assistant",
                ConversationMessage.created_at >= existing.created_at,
            ).order_by(ConversationMessage.created_at).limit(1))
            if answer is not None:
                return _message_read(answer)

    selected = db.get(Material, payload.material_id) if payload.material_id else None
    if payload.material_id and (selected is None or selected.course_id != conversation.course_id or selected.deleted_at is not None):
        raise HTTPException(status_code=404, detail="所选资料不属于当前课程")
    user = ConversationMessage(
        conversation_id=conversation_id, role="user", content=payload.question.strip(),
        learning_goal=payload.learning_goal, status="completed", idempotency_key=payload.idempotency_key,
    )
    db.add(user)
    db.flush()
    history = [(message.role, message.content) for message in conversation.messages if message.id != user.id]
    course = ensure_course(db, conversation.course_id)
    try:
        result = run_answer(
            db,
            course_id=conversation.course_id,
            course_name=course.name,
            question=payload.question,
            material_id=payload.material_id,
            page_number=payload.page_number,
            allow_web=payload.allow_web,
            history=history,
        )
        assistant = ConversationMessage(
            conversation_id=conversation_id, role="assistant", content=result["answer"],
            learning_goal=payload.learning_goal, status="completed", model_version=result.get("model_version"),
        )
        db.add(assistant)
        db.flush()
        for chunk in result["chunks"]:
            source_ref = db.scalar(select(SourceRef).where(
                SourceRef.page_block_id == chunk.page_block_id,
                SourceRef.status == "active",
            )) if chunk.page_block_id else None
            db.add(MessageEvidence(
                message_id=assistant.id,
                source_ref_id=source_ref.id if source_ref else None,
                claim_key="answer",
                evidence_type="course_direct" if chunk.direct_support else "course_related",
                support_level="direct" if chunk.direct_support else "related",
            ))
        for item in result["web_results"]:
            source = db.scalar(select(WebSource).where(WebSource.course_id == conversation.course_id, WebSource.url == item["url"]))
            if source is not None:
                db.add(MessageEvidence(
                    message_id=assistant.id, web_source_id=source.id, claim_key="answer",
                    evidence_type="web_supplement", support_level="supplement",
                ))
        conversation.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(assistant)
        return _message_read(assistant)
    except Exception as exc:
        db.rollback()
        failed = ConversationMessage(
            conversation_id=conversation_id, role="assistant",
            content="本次回答未完成，已保留失败状态；请稍后重试或查看课程检索片段。",
            learning_goal=payload.learning_goal, status="failed", failure_type=type(exc).__name__,
        )
        db.add(failed)
        db.commit()
        db.refresh(failed)
        return _message_read(failed)
