"""Explainable deterministic reranking for local retrieval."""

from __future__ import annotations

import re
from dataclasses import replace

from app.retrieval.service import RetrievedChunk


def rerank(question: str, chunks: list[RetrievedChunk], *, limit: int = 5) -> list[RetrievedChunk]:
    terms = [item.casefold() for item in re.findall(r"[A-Za-z0-9_\u4e00-\u9fff]{2,}", question)]
    ranked: list[RetrievedChunk] = []
    for chunk in chunks:
        lower = chunk.text.casefold()
        lexical = sum(lower.count(term) for term in terms)
        ranked.append(replace(chunk, score=chunk.score + lexical * 0.25))
    ranked.sort(key=lambda item: item.score, reverse=True)
    return ranked[:limit]
