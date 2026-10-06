"""Offline retrieval evaluation helpers; no claim of semantic quality without labels."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from time import perf_counter

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
    latencies: list[float] = []
    direct_support_hits = 0
    score_sources: Counter[str] = Counter()
    for example in examples:
        started = perf_counter()
        results = retrieve(db, course_id=course_id, question=example.question, material_id=example.material_id, limit=limit)
        latency_ms = round((perf_counter() - started) * 1000, 3)
        latencies.append(latency_ms)
        pages = [item.page_number for item in results]
        rank = next((index + 1 for index, page in enumerate(pages) if page in example.expected_page_numbers), None)
        if rank:
            hits += 1
            reciprocal_rank += 1 / rank
        direct_support = any(item.direct_support for item in results)
        if direct_support:
            direct_support_hits += 1
        score_sources.update(item.score_source for item in results)
        rows.append({
            "question": example.question,
            "pages": pages,
            "rank": rank,
            "direct_support": direct_support,
            "score_sources": sorted({item.score_source for item in results}),
            "latency_ms": latency_ms,
        })
    total = len(examples)
    ordered_latencies = sorted(latencies)
    p95_index = min(len(ordered_latencies) - 1, max(0, int(len(ordered_latencies) * 0.95) - 1)) if ordered_latencies else None
    return {
        "examples": total,
        "hit_rate": hits / total if total else 0.0,
        "mrr": reciprocal_rank / total if total else 0.0,
        "direct_support_rate": direct_support_hits / total if total else 0.0,
        "latency_ms_avg": round(sum(latencies) / total, 3) if total else 0.0,
        "latency_ms_p95": ordered_latencies[p95_index] if p95_index is not None else 0.0,
        "score_sources": dict(score_sources),
        "rows": rows,
        "embedding_mode": "hybrid" if score_sources.get("hybrid") else "keyword",
    }
