from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.shared import ensure_course
from app.db.database import get_db
from app.db.models import (
    KnowledgeEdge,
    KnowledgeNode,
    MaterialPage,
    PageBlock,
    SourceRef,
)
from app.schemas.api import (
    KnowledgeEdgeRead,
    KnowledgeGraphRead,
    KnowledgeNodeRead,
    KnowledgeNodeSourceRead,
    KnowledgeNodeWithSourcesRead,
)

router = APIRouter()


@router.get("/courses/{course_id}/knowledge-graph", response_model=KnowledgeGraphRead)
def get_knowledge_graph(course_id: str, db: Session = Depends(get_db)) -> KnowledgeGraphRead:
    ensure_course(db, course_id)
    nodes = list(
        db.scalars(
            select(KnowledgeNode).options(
                selectinload(KnowledgeNode.source_refs)
                .selectinload(SourceRef.page_block)
                .selectinload(PageBlock.page)
                .selectinload(MaterialPage.material)
            )
            .where(KnowledgeNode.course_id == course_id)
            .order_by(KnowledgeNode.name)
        ).all()
    )
    edges = list(
        db.scalars(
            select(KnowledgeEdge)
            .where(KnowledgeEdge.course_id == course_id)
            .order_by(KnowledgeEdge.created_at)
        ).all()
    )
    return KnowledgeGraphRead(
        nodes=[
            KnowledgeNodeWithSourcesRead(
                **KnowledgeNodeRead.model_validate(node).model_dump(),
                sources=[
                    KnowledgeNodeSourceRead(
                        material_id=source.page_block.page.material_id,
                        lecture_title=source.page_block.page.material.lecture_title,
                        topic_title=source.page_block.page.material.topic_title,
                        page_number=source.page_block.page.page_number,
                    )
                    for source in node.source_refs
                ],
            )
            for node in nodes
        ],
        edges=[KnowledgeEdgeRead.model_validate(edge) for edge in edges],
    )
