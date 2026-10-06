from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    target_type: str = Field(pattern="^(assistant_message|note|knowledge_proposal|source)$")
    target_id: str = Field(min_length=1, max_length=36)
    category: str = Field(pattern="^(helpful|not_helpful|incorrect|missing_source|correction)$")
    comment: str | None = Field(default=None, max_length=5000)


class FeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    target_type: str
    target_id: str
    category: str
    comment: str | None
    status: str
    resolution: str | None
    created_at: datetime
    updated_at: datetime
