from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[4]
load_dotenv(PROJECT_ROOT / ".env", override=False)


def _resolve_data_dir() -> Path:
    configured = os.getenv("NOTEBOOK_DATA_DIR", "./data")
    configured_path = Path(configured)
    if not configured_path.is_absolute():
        configured_path = PROJECT_ROOT / configured_path
    return configured_path.resolve()


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    max_upload_bytes: int
    deepseek_api_key: str | None
    deepseek_base_url: str
    deepseek_model: str
    deepseek_timeout_seconds: float
    tavily_api_key: str | None
    web_search_timeout_seconds: float
    embedding_base_url: str | None
    embedding_api_key: str | None
    embedding_model: str | None
    allowed_extensions: tuple[str, ...] = (".pptx",)

    @property
    def originals_dir(self) -> Path:
        return self.data_dir / "originals"

    @property
    def derived_dir(self) -> Path:
        return self.data_dir / "derived"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{(self.data_dir / 'notebook.sqlite3').as_posix()}"


settings = Settings(
    data_dir=_resolve_data_dir(),
    max_upload_bytes=int(os.getenv("NOTEBOOK_MAX_UPLOAD_MB", "50")) * 1024 * 1024,
    deepseek_api_key=os.getenv("DEEPSEEK_API_KEY") or None,
    deepseek_base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    deepseek_model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
    deepseek_timeout_seconds=float(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "60")),
    tavily_api_key=os.getenv("TAVILY_API_KEY") or None,
    web_search_timeout_seconds=float(os.getenv("WEB_SEARCH_TIMEOUT_SECONDS", "20")),
    embedding_base_url=os.getenv("EMBEDDING_BASE_URL") or None,
    embedding_api_key=os.getenv("EMBEDDING_API_KEY") or None,
    embedding_model=os.getenv("EMBEDDING_MODEL") or None,
)
