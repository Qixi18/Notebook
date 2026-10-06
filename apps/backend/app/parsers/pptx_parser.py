from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

from app.parsers.base import PARSER_VERSION, ParsedDocument
from app.parsers.base import ParsedBlock as DocumentBlock
from app.parsers.base import ParsedPage as DocumentPage


class ParsedBlock(TypedDict):
    block_type: str
    content: str
    position: int
    font_size: float | None
    is_bold: bool
    object_id: str | None
    location_label: str
    extraction_method: str
    confidence: float
    warning: str | None


class ParsedPage(TypedDict):
    page_number: int
    title: str | None
    raw_text: str
    warning: str | None
    blocks: list[ParsedBlock]
    location_type: str
    location_label: str
    stable_location_key: str
    extraction_method: str
    confidence: float


def _shape_font_size(shape: object) -> float | None:
    text_frame = getattr(shape, "text_frame", None)
    if text_frame is None:
        return None
    values: list[float] = []
    for paragraph in text_frame.paragraphs:
        for run in paragraph.runs:
            if run.font.size is not None:
                values.append(float(run.font.size.pt))
    return max(values) if values else None


def _shape_is_bold(shape: object) -> bool:
    text_frame = getattr(shape, "text_frame", None)
    if text_frame is None:
        return False
    return any(
        run.font.bold is True for paragraph in text_frame.paragraphs for run in paragraph.runs
    )


def parse_pptx(path: Path) -> list[ParsedPage]:
    return [_as_legacy_page(page) for page in parse_pptx_document(path).pages]


def parse_pptx_document(path: Path) -> ParsedDocument:
    presentation = Presentation(path)
    pages: list[DocumentPage] = []
    document_warnings: list[str] = []

    for page_number, slide in enumerate(presentation.slides, start=1):
        blocks: list[DocumentBlock] = []
        page_warnings: list[str] = []
        for position, shape in enumerate(slide.shapes):
            text = getattr(shape, "text", "")
            block_type = "title" if position == 0 else "text"
            warning = None
            if getattr(shape, "has_table", False):
                block_type = "table"
                rows = [" | ".join(cell.text.strip() for cell in row.cells) for row in shape.table.rows]
                text = "\n".join(row for row in rows if row.strip())
            elif getattr(shape, "shape_type", None) in {
                MSO_SHAPE_TYPE.PICTURE,
                MSO_SHAPE_TYPE.GROUP,
                MSO_SHAPE_TYPE.CHART,
                MSO_SHAPE_TYPE.TABLE,
                MSO_SHAPE_TYPE.MEDIA,
            }:
                block_type = "image_or_object"
                warning = "图片、公式或复杂对象未提取为文字；可按需启用 OCR"
            if not isinstance(text, str) or not text.strip():
                if warning:
                    blocks.append(DocumentBlock(
                        block_type=block_type,
                        content="",
                        position=position,
                        object_id=str(getattr(shape, "shape_id", position)),
                        location_label=f"第 {page_number} 页 · 对象 {position + 1}",
                        extraction_method="unavailable",
                        confidence=0.0,
                        warning=warning,
                    ))
                    page_warnings.append(warning)
                continue
            cleaned = text.strip()
            blocks.append(
                DocumentBlock(block_type=block_type, content=cleaned, position=position,
                              object_id=str(getattr(shape, "shape_id", position)),
                              location_label=f"第 {page_number} 页 · 对象 {position + 1}",
                              font_size=_shape_font_size(shape), is_bold=_shape_is_bold(shape),
                              extraction_method="table_parse" if block_type == "table" else "native_text",
                              confidence=1.0, warning=warning)
            )

        raw_text = "\n\n".join(block.content for block in blocks)
        pages.append(
            DocumentPage(page_number=page_number,
                         title=blocks[0].content[:500] if blocks else None,
                         raw_text=raw_text, location_type="page",
                         location_label=f"第 {page_number} 页",
                         stable_location_key=f"slide:{page_number}",
                         warning=("；".join(dict.fromkeys(page_warnings)) if page_warnings else
                                  ("本页没有识别到文本内容，建议按需 OCR" if not any(block.content for block in blocks) else None)),
                         extraction_method="native_text", confidence=1.0,
                         blocks=blocks)
        )
        if not any(block.content for block in blocks):
            document_warnings.append(f"第 {page_number} 页没有识别到文本")
        document_warnings.extend(page_warnings)

    return ParsedDocument(format="pptx", parser_version=PARSER_VERSION, pages=pages,
                          warnings=document_warnings)


def _as_legacy_page(page: DocumentPage) -> ParsedPage:
    return {
        "page_number": page.page_number,
        "title": page.title,
        "raw_text": page.raw_text,
        "warning": page.warning,
        "blocks": [
            {
                "block_type": block.block_type,
                "content": block.content,
                "position": block.position,
                "font_size": block.font_size,
                "is_bold": block.is_bold,
                "object_id": block.object_id,
                "location_label": block.location_label or "",
                "extraction_method": block.extraction_method,
                "confidence": block.confidence or 1.0,
                "warning": block.warning,
            }
            for block in page.blocks
        ],
        "location_type": page.location_type,
        "location_label": page.location_label or "",
        "stable_location_key": page.stable_location_key,
        "extraction_method": page.extraction_method,
        "confidence": page.confidence or 1.0,
    }
