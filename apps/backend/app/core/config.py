from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[4]


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
)
