from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProviderCallRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    operation: str
    status: str
    course_id: str | None
    material_id: str | None
    model: str | None
    request_units: int | None
    response_units: int | None
    estimated_cost_usd: float | None
    duration_ms: float | None
    error_type: str | None
    metadata_json: str
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
