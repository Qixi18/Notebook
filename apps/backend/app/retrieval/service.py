from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Material, MaterialPage, PageBlock, RetrievalChunk
from app.retrieval.embedding import EmbeddingClient, EmbeddingError


@dataclass(frozen=True)
class RetrievedChunk:
    material_id: str
    lecture_title: str
    page_number: int
    text: str
    score: float
    page_block_id: str | None = None
    location_label: str | None = None
    score_source: str = "keyword"
    direct_support: bool = True


def index_material(db: Session, material_id: str) -> None:
    material = db.get(Material, material_id)
    if material is None:
        return
    blocks = list(
        db.scalars(
            select(PageBlock)
            .join(MaterialPage, PageBlock.page_id == MaterialPage.id)
            .where(
                MaterialPage.material_id == material_id,
                MaterialPage.is_active.is_(True),
                PageBlock.content != "",
            )
            .order_by(PageBlock.id)
        ).all()
    )
    client = EmbeddingClient()
    vectors: list[list[float]] = []
    texts = [block.content.strip() for block in blocks]
    if client.configured and texts:
        try:
            vectors = client.embed(texts)
        except EmbeddingError:
            vectors = []

    for index, block in enumerate(blocks):
        chunk = db.scalar(select(RetrievalChunk).where(RetrievalChunk.page_block_id == block.id))
        if chunk is None:
            chunk = RetrievalChunk(
                course_id=material.course_id, page_block_id=block.id, text=texts[index]
            )
            db.add(chunk)
        chunk.text = texts[index]
        chunk.embedding_model = settings_model() if vectors else None
        chunk.embedding_json = json.dumps(vectors[index], ensure_ascii=False) if vectors else None
    db.commit()


def retrieve(
    db: Session,
    *,
    course_id: str,
    question: str,
    material_id: str | None = None,
    page_number: int | None = None,
    limit: int = 5,
) -> list[RetrievedChunk]:
    query = (
        select(RetrievalChunk, PageBlock, MaterialPage, Material)
        .join(PageBlock, RetrievalChunk.page_block_id == PageBlock.id)
        .join(MaterialPage, PageBlock.page_id == MaterialPage.id)
        .join(Material, MaterialPage.material_id == Material.id)
        .where(
            RetrievalChunk.course_id == course_id,
            Material.deleted_at.is_(None),
            MaterialPage.is_active.is_(True),
            PageBlock.content != "",
        )
    )
    if material_id:
        query = query.where(Material.id == material_id)
    if page_number:
        query = query.where(MaterialPage.page_number == page_number)

    terms = query_terms(question)
    query_vector: list[float] | None = None
    client = EmbeddingClient()
    if client.configured:
        try:
            query_vector = client.embed([question])[0]
        except EmbeddingError:
            query_vector = None
    results: list[RetrievedChunk] = []
    for chunk, block, page, material in db.execute(query).all():
        text = chunk.text.strip()
        haystack = text.lower()
        lexical_score = float(sum(haystack.count(term) for term in terms))
        vector_score = 0.0
        if query_vector and chunk.embedding_json:
            try:
                vector_score = cosine_similarity(query_vector, json.loads(chunk.embedding_json))
            except (TypeError, ValueError, json.JSONDecodeError):
                vector_score = 0.0
        score = vector_score * 10 + lexical_score
        if score > 0:
            results.append(
                RetrievedChunk(
                    material_id=material.id,
                    lecture_title=material.lecture_title,
                    page_number=page.page_number,
                    text=text,
                    score=score,
                    page_block_id=chunk.page_block_id,
                    location_label=block.location_label or page.location_label,
                    score_source="hybrid" if vector_score else "keyword",
                    direct_support=lexical_score > 0 or vector_score >= 0.55,
                )
            )
    results.sort(key=lambda item: item.score, reverse=True)
    return results[:limit]


def build_context(chunks: list[RetrievedChunk]) -> str:
    return "\n\n".join(
        f"[第 {chunk.page_number} 页 | {chunk.lecture_title}]\n{chunk.text}" for chunk in chunks
    )


def settings_model() -> str:
    from app.core.config import settings

    return settings.embedding_model or "configured-embedding"


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    product = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return product / (left_norm * right_norm)


def query_terms(question: str) -> list[str]:
    """Extract searchable terms without treating a whole Chinese sentence as one word."""
    terms: list[str] = []
    for token in re.findall(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]+", question.lower()):
        if re.fullmatch(r"[\u4e00-\u9fff]+", token):
            terms.extend(token[index : index + 2] for index in range(len(token) - 1))
            if len(token) > 1:
                terms.append(token)
        elif len(token) > 1:
            terms.append(token)
    return list(dict.fromkeys(terms))
