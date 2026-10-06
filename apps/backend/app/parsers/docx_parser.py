"""DOCX extraction using document order and explicit paragraph locations."""

from __future__ import annotations

from pathlib import Path

from docx import Document

from app.parsers.base import PARSER_VERSION, ParsedBlock, ParsedDocument, ParsedPage


def parse_docx(path: Path) -> ParsedDocument:
    document = Document(str(path))
    pages: list[ParsedPage] = []
    warnings: list[str] = []
    section_index = 0
    current: list[ParsedBlock] = []
    section_title = "未命名章节"
    paragraph_index = 0

    def flush() -> None:
        nonlocal section_index, current
        if not current:
            return
        section_index += 1
        label = f"章节/段落：{section_title} · {len(current)} 个块"
        key = f"docx-section:{section_index}"
        raw = "\n\n".join(block.content for block in current)
        pages.append(ParsedPage(
            page_number=section_index,
            title=section_title,
            raw_text=raw,
            location_type="section",
            location_label=label,
            stable_location_key=key,
            warning="DOCX 没有可靠固定页码；位置按章节与文档顺序记录",
            extraction_method="native_text",
            confidence=1.0,
            blocks=list(current),
        ))
        current = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        paragraph_index += 1
        style_name = paragraph.style.name if paragraph.style is not None else ""
        if style_name.lower().startswith("heading"):
            flush()
            section_title = text[:500]
        current.append(ParsedBlock(
            block_type="heading" if style_name.lower().startswith("heading") else "paragraph",
            content=text,
            position=paragraph_index,
            object_id=f"paragraph-{paragraph_index}",
            location_label=f"段落 {paragraph_index}",
            extraction_method="native_text",
            confidence=1.0,
        ))

    for table_index, table in enumerate(document.tables, start=1):
        rows = [" | ".join(cell.text.strip() for cell in row.cells) for row in table.rows]
        text = "\n".join(row for row in rows if row.strip())
        if text:
            current.append(ParsedBlock(
                block_type="table",
                content=text,
                position=paragraph_index + table_index,
                object_id=f"table-{table_index}",
                location_label=f"表格 {table_index}",
                extraction_method="table_parse",
                confidence=1.0,
            ))

    flush()
    if not pages:
        warnings.append("DOCX 没有识别到段落或表格")
    if document.inline_shapes:
        warnings.append(f"发现 {len(document.inline_shapes)} 个图片对象，未臆造图片文字；可按需 OCR")
    return ParsedDocument(format="docx", parser_version=PARSER_VERSION, pages=pages, warnings=warnings)
