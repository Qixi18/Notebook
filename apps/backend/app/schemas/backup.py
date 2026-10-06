from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BackupExportRequest(BaseModel):
    course_id: str | None = None


class BackupRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str | None
    action: str
    path: str | None
    status: str
    manifest_json: str
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None


class BackupPreviewRead(BaseModel):
    valid: bool
    format: int | None = None
    created_at: str | None = None
    course_count: int = 0
    material_count: int = 0
    original_count: int = 0
    total_bytes: int = 0
    conflicts: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class RestoreRequest(BaseModel):
    strategy: str = Field(default="replace", pattern="^replace$")
    confirmed: bool = False
