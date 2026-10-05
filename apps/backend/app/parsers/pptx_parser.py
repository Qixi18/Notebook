from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from pptx import Presentation


class ParsedBlock(TypedDict):
    block_type: str
    content: str
    position: int
    font_size: float | None
    is_bold: bool


class ParsedPage(TypedDict):
    page_number: int
    title: str | None
    raw_text: str
    warning: str | None
    blocks: list[ParsedBlock]


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
    presentation = Presentation(path)
    pages: list[ParsedPage] = []

    for page_number, slide in enumerate(presentation.slides, start=1):
        blocks: list[ParsedBlock] = []
        for position, shape in enumerate(slide.shapes):
            text = getattr(shape, "text", "")
            if not isinstance(text, str) or not text.strip():
                continue
            cleaned = text.strip()
            blocks.append(
                {
                    "block_type": "title" if position == 0 else "text",
                    "content": cleaned,
                    "position": position,
                    "font_size": _shape_font_size(shape),
                    "is_bold": _shape_is_bold(shape),
                }
            )

        raw_text = "\n\n".join(block["content"] for block in blocks)
        pages.append(
            {
                "page_number": page_number,
                "title": blocks[0]["content"][:500] if blocks else None,
                "raw_text": raw_text,
                "warning": "本页没有识别到文本内容" if not blocks else None,
                "blocks": blocks,
            }
        )

    return pages
