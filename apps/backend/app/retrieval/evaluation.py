"""Offline retrieval evaluation helpers; no claim of semantic quality without labels."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.retrieval.service import retrieve


@dataclass(frozen=True)
class RetrievalExample:
    question: str
    expected_page_numbers: tuple[int, ...]
    material_id: str | None = None


def evaluate(db: Session, *, course_id: str, examples: list[RetrievalExample], limit: int = 5) -> dict:
    hits = 0
    reciprocal_rank = 0.0
    rows = []
    for example in examples:
        results = retrieve(db, course_id=course_id, question=example.question, material_id=example.material_id, limit=limit)
        pages = [item.page_number for item in results]
        rank = next((index + 1 for index, page in enumerate(pages) if page in example.expected_page_numbers), None)
        if rank:
            hits += 1
            reciprocal_rank += 1 / rank
        rows.append({"question": example.question, "pages": pages, "rank": rank})
    total = len(examples)
    return {
        "examples": total,
        "hit_rate": hits / total if total else 0.0,
        "mrr": reciprocal_rank / total if total else 0.0,
        "rows": rows,
        "embedding_mode": "configured-or-keyword-fallback",
    }
