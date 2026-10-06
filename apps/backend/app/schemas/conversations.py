from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    title: str = Field(default="新对话", min_length=1, max_length=300)
    default_scope: str = Field(default="course", pattern="^(course|material|page)$")


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    title: str
    default_scope: str
    created_at: datetime
    updated_at: datetime


class MessageEvidenceRead(BaseModel):
    id: str
    claim_key: str
    evidence_type: str
    support_level: str
    source_ref_id: str | None = None
    web_source_id: str | None = None
    snippet: str | None = None
    location_label: str | None = None


class ConversationMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    learning_goal: str | None
    status: str
    model_version: str | None
    failure_type: str | None
    created_at: datetime
    evidence: list[MessageEvidenceRead] = Field(default_factory=list)


class ConversationMessageCreate(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    learning_goal: str | None = Field(default=None, max_length=60)
    material_id: str | None = None
    page_number: int | None = Field(default=None, ge=1)
    allow_web: bool = True
    idempotency_key: str | None = Field(default=None, max_length=120)
