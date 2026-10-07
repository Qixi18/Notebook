from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SettingsSection(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProviderSettings(SettingsSection):
    configured: bool
    masked_key: str | None = None
    base_url: str | None = None
    model: str | None = None
    timeout_seconds: float | None = None


class StorageSettings(SettingsSection):
    data_dir: str
    database: str
    max_upload_mb: int


class SettingsLimits(SettingsSection):
    allowed_extensions: list[str]
    editable_keys: list[str]
    secret_write_enabled: bool
    token_required: bool


class SettingsSource(SettingsSection):
    env_path: str
    env_exists: bool
    override_keys: list[str]


class SettingsStatus(SettingsSection):
    deepseek: ProviderSettings
    embedding: ProviderSettings
    storage: StorageSettings
    limits: SettingsLimits
    source: SettingsSource


class SettingsUpdate(SettingsSection):
    DEEPSEEK_BASE_URL: str | None = None
    DEEPSEEK_MODEL: str | None = None
    DEEPSEEK_TIMEOUT_SECONDS: str | None = None
    NOTEBOOK_MAX_UPLOAD_MB: str | None = None
    EMBEDDING_BASE_URL: str | None = None
    EMBEDDING_MODEL: str | None = None
    DEEPSEEK_API_KEY: str | None = None
    EMBEDDING_API_KEY: str | None = None


class SettingsUpdateResponse(SettingsSection):
    updated: list[str]
    backup_path: str | None = None
    status: SettingsStatus
    warnings: list[str] = Field(default_factory=list)
