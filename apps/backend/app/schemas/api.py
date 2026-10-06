from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class CourseUpdate(BaseModel):
    """课程重命名。only name 允许修改，避免误改关联数据。"""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)


class CourseDeleteResponse(BaseModel):
    deleted_course_id: str
    deleted_materials: int
    deleted_pages: int
    deleted_knowledge_nodes: int
    deleted_notes: int


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


class DeepSeekStatus(BaseModel):
    configured: bool
    masked_key: str | None
    base_url: str
    model: str
    timeout_seconds: float


class EmbeddingStatus(BaseModel):
    configured: bool
    masked_key: str | None
    base_url: str | None
    model: str | None


class StorageStatus(BaseModel):
    data_dir: str
    database: str
    max_upload_mb: int


class LimitsStatus(BaseModel):
    allowed_extensions: list[str]
    editable_keys: list[str]
    secret_write_enabled: bool
    token_required: bool


class SettingsSource(BaseModel):
    env_path: str
    env_exists: bool
    override_keys: list[str]


class SettingsStatus(BaseModel):
    deepseek: DeepSeekStatus
    embedding: EmbeddingStatus
    storage: StorageStatus
    limits: LimitsStatus
    source: SettingsSource


class SettingsUpdate(BaseModel):
    """只接受白名单键；未知键会被显式拒绝，不静默丢弃。

    密钥字段（DEEPSEEK_API_KEY / EMBEDDING_API_KEY）虽在 schema 中声明，
    但真正写入还需通过后端开关 + 口令校验，见 `settings_store.apply_updates`。
    """

    model_config = ConfigDict(extra="forbid")

    DEEPSEEK_BASE_URL: str | None = None
    DEEPSEEK_MODEL: str | None = None
    DEEPSEEK_TIMEOUT_SECONDS: str | None = None
    EMBEDDING_BASE_URL: str | None = None
    EMBEDDING_MODEL: str | None = None
    NOTEBOOK_MAX_UPLOAD_MB: str | None = None
    DEEPSEEK_API_KEY: str | None = None
    EMBEDDING_API_KEY: str | None = None


class SettingsUpdateResponse(BaseModel):
    updated: list[str]
    backup_path: str | None
    status: SettingsStatus
    warnings: list[str] = []
