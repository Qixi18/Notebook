"""Optional OCR adapter with explicit capability and resource limits."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class OCRUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class OCRConfig:
    enabled: bool = False
    max_pages: int = 10
    language: str = "chi_sim+eng"


def config() -> OCRConfig:
    return OCRConfig(
        enabled=os.getenv("NOTEBOOK_OCR_ENABLED", "").lower() in {"1", "true", "yes"},
        max_pages=max(1, int(os.getenv("NOTEBOOK_OCR_MAX_PAGES", "10"))),
        language=os.getenv("NOTEBOOK_OCR_LANGUAGE", "chi_sim+eng"),
    )


def ocr_image(path: Path, *, page_number: int) -> tuple[str, str, float]:
    settings = config()
    if not settings.enabled:
        raise OCRUnavailable("OCR 未启用；请配置 NOTEBOOK_OCR_ENABLED=true 后按需重试")
    if page_number > settings.max_pages:
        raise OCRUnavailable(f"OCR 页数超过限制（最多 {settings.max_pages} 页）")
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise OCRUnavailable("OCR 依赖未安装；当前只保留 OCR 候选告警") from exc
    text = pytesseract.image_to_string(Image.open(path), lang=settings.language).strip()
    return text, "ocr_tesseract", 0.7 if text else 0.0
