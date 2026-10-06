"""DOCX extraction using document order and explicit paragraph locations."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.document import Document as DocumentObject
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.parsers.base import PARSER_VERSION, ParsedBlock, ParsedDocument, ParsedPage


def _iter_body_blocks(document: DocumentObject):
    for child in document.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield Table(child, document)


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

    table_index = 0
    image_index = 0
    for body_block in _iter_body_blocks(document):
        if isinstance(body_block, Paragraph):
            text = body_block.text.strip()
            image_count = len(body_block._p.xpath('.//a:blip'))
            if not text and not image_count:
                continue
            paragraph_index += 1
            style_name = body_block.style.name if body_block.style is not None else ""
            if text and style_name.lower().startswith("heading"):
                flush()
                section_title = text[:500]
            if text:
                current.append(ParsedBlock(
                    block_type="heading" if style_name.lower().startswith("heading") else "paragraph",
                    content=text,
                    position=paragraph_index,
                    object_id=f"paragraph-{paragraph_index}",
                    location_label=f"段落 {paragraph_index}",
                    extraction_method="native_text",
                    confidence=1.0,
                ))
            for _ in range(image_count):
                image_index += 1
                current.append(ParsedBlock(
                    block_type="image",
                    content="",
                    position=paragraph_index,
                    object_id=f"paragraph-{paragraph_index}-image-{image_index}",
                    location_label=f"段落 {paragraph_index} · 图片 {image_index}",
                    extraction_method="unavailable",
                    confidence=0.0,
                    warning="图片对象未提取为文字；可按需启用 OCR",
                ))
            continue

        table_index += 1
        rows = [" | ".join(cell.text.strip() for cell in row.cells) for row in body_block.rows]
        text = "\n".join(row for row in rows if row.strip())
        paragraph_index += 1
        current.append(ParsedBlock(
            block_type="table",
            content=text,
            position=paragraph_index,
            object_id=f"table-{table_index}",
            location_label=f"表格 {table_index}",
            extraction_method="table_parse",
            confidence=1.0 if text else 0.0,
            warning=None if text else "表格没有可提取的文字",
        ))

    flush()
    if not pages:
        warnings.append("DOCX 没有识别到段落或表格")
    if document.inline_shapes:
        warnings.append(f"发现 {len(document.inline_shapes)} 个图片对象，未臆造图片文字；可按需 OCR")
    return ParsedDocument(format="docx", parser_version=PARSER_VERSION, pages=pages, warnings=warnings)
