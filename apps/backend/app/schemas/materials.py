from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.jobs import JobRead


class MaterialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    lecture_title: str
    topic_title: str | None
    original_filename: str
    media_type: str | None
    size_bytes: int
    status: str
    page_count: int
    created_at: datetime
    deleted_at: datetime | None = None



class PageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    material_id: str
    page_number: int
    title: str | None
    raw_text: str
    parse_status: str
    warning: str | None



class SourceRefRead(BaseModel):
    id: str
    page_block_id: str
    source_type: str
    quote: str
    material_id: str
    page_number: int



class UploadMaterialResponse(BaseModel):
    material: MaterialRead
    job: JobRead



class WebSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    url: str
    site_name: str
    snippet: str
    search_query: str
    score: float | None
    published_at: str | None
    retrieved_at: datetime
