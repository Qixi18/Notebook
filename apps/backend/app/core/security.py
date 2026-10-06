"""Small security boundaries shared by local backup and external text flows."""

from __future__ import annotations

import re
from pathlib import PurePosixPath


def safe_filename(value: str, *, fallback: str = "upload") -> str:
    name = PurePosixPath(value.replace("\\", "/")).name
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return name[:255] or fallback


def validate_archive_member(name: str) -> str:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name:
        raise ValueError(f"unsafe archive path: {name}")
    normalized = str(path)
    if normalized in {"", "."}:
        raise ValueError("empty archive path")
    return normalized


def redact_secrets(value: str) -> str:
    return re.sub(r"(?i)(api[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+", r"\1=[REDACTED]", value)
