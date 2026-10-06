"""Select a parser from the server-controlled file suffix."""

from __future__ import annotations

from pathlib import Path

from app.parsers.base import ParsedDocument
from app.parsers.docx_parser import parse_docx
from app.parsers.pdf_parser import parse_pdf
from app.parsers.pptx_parser import parse_pptx_document


def parse_document(path: Path) -> ParsedDocument:
    suffix = path.suffix.lower()
    if suffix == ".pptx":
        return parse_pptx_document(path)
    if suffix == ".pdf":
        return parse_pdf(path)
    if suffix == ".docx":
        return parse_docx(path)
    raise ValueError(f"不支持的文件格式：{suffix or '无扩展名'}")
