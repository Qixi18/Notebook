"""Conservative PDF text extraction.

The parser never invents text for a scanned page. Empty text pages are returned
as OCR candidates with a visible warning so a later OCR task can be requested.
"""

from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

from app.parsers.base import PARSER_VERSION, ParsedBlock, ParsedDocument, ParsedPage


def parse_pdf(path: Path) -> ParsedDocument:
    reader = PdfReader(str(path))
    pages: list[ParsedPage] = []
    warnings: list[str] = []
    for number, source_page in enumerate(reader.pages, start=1):
        text = (source_page.extract_text() or "").strip()
        warning = None
        method = "native_text"
        confidence = 1.0
        if not text:
            warning = "本页没有可提取的文字层，建议按需启用 OCR；当前未生成伪文本"
            warnings.append(f"第 {number} 页需要 OCR")
            method = "ocr_candidate"
            confidence = 0.0
        block = ParsedBlock(
            block_type="text",
            content=text,
            position=0,
            object_id=f"pdf-page-{number}",
            location_label=f"第 {number} 页",
            extraction_method=method,
            confidence=confidence,
            warning=warning,
        )
        pages.append(
            ParsedPage(
                page_number=number,
                title=text.splitlines()[0][:500] if text else None,
                raw_text=text,
                location_type="page",
                location_label=f"第 {number} 页",
                stable_location_key=f"pdf-page:{number}",
                parse_status="parsed" if text else "ocr_candidate",
                warning=warning,
                extraction_method=method,
                confidence=confidence,
                blocks=[block],
            )
        )
    return ParsedDocument(format="pdf", parser_version=PARSER_VERSION, pages=pages, warnings=warnings)
