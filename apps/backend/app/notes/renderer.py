from __future__ import annotations

from collections.abc import Iterable

from app.db.models import SourceRef


def render_note_markdown(
    *,
    title: str,
    summary: str,
    key_points: list[str],
    methods: list[str],
    formulas: list[str],
    source_refs: Iterable[SourceRef],
) -> str:
    lines = [f"# {title}", "", "## 一句话理解", "", summary or "待补充", ""]
    if key_points:
        lines.extend(["## 重点", "", *[f"- {item}" for item in key_points], ""])
    if methods:
        lines.extend(["## 方法与应用", "", *[f"- {item}" for item in methods], ""])
    if formulas:
        lines.extend(["## 公式与定理", ""])
        for formula in formulas:
            lines.extend(["$$", formula.strip("$ "), "$$", ""])
    refs = list(source_refs)
    if refs:
        lines.extend(["## 课件来源", ""])
        seen: set[tuple[str, int]] = set()
        for source_ref in refs:
            page = source_ref.page_block.page
            key = (page.material_id, page.page_number)
            if key in seen:
                continue
            seen.add(key)
            quote = source_ref.quote.replace("\n", " ").strip()[:120]
            lines.append(f"- 第 {page.page_number} 页：{quote}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"
