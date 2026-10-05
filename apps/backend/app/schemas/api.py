from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    created_at: datetime


class MaterialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    lecture_title: str
    original_filename: str
    media_type: str | None
    size_bytes: int
    status: str
    page_count: int
    created_at: datetime


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    material_id: str
    kind: str
    status: str
    progress: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime


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


class KnowledgeNodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    name: str
    summary: str | None
    status: str


class KnowledgeEdgeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    source_node_id: str
    target_node_id: str
    relation_type: str
    confidence: float | None
    created_by: str


class KnowledgeGraphRead(BaseModel):
    nodes: list[KnowledgeNodeRead]
    edges: list[KnowledgeEdgeRead]


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    knowledge_node_id: str
    title: str
    content_markdown: str
    content_origin: str
    user_locked: bool
    revision_number: int
    created_at: datetime
    updated_at: datetime


class NoteRevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    note_id: str
    revision_number: int
    content_markdown: str
    content_origin: str
    user_locked: bool
    created_at: datetime


class NoteUpdate(BaseModel):
    content_markdown: str = Field(min_length=1, max_length=100000)
    expected_revision_number: int = Field(ge=1)


class UploadMaterialResponse(BaseModel):
    material: MaterialRead
    job: JobRead


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    material_id: str | None = None
    page_number: int | None = None


class AssistantSource(BaseModel):
    material_id: str
    lecture_title: str
    page_number: int
    snippet: str


class AssistantResponse(BaseModel):
    answer: str
    sources: list[AssistantSource]
    mode: str = "local-retrieval-preview"
