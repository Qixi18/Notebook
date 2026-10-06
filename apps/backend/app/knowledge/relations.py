"""Safe graph relation creation after candidate IDs are resolved."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import KnowledgeEdge, KnowledgeNode

ALLOWED_RELATIONS = {"related", "prerequisite", "deepens", "parent"}


def _would_cycle(db: Session, source_id: str, target_id: str) -> bool:
    if source_id == target_id:
        return True
    edges = db.scalars(select(KnowledgeEdge).where(KnowledgeEdge.relation_type != "related")).all()
    adjacency: dict[str, set[str]] = {}
    for edge in edges:
        adjacency.setdefault(edge.source_node_id, set()).add(edge.target_node_id)
    pending = [target_id]
    seen: set[str] = set()
    while pending:
        current = pending.pop()
        if current == source_id:
            return True
        if current in seen:
            continue
        seen.add(current)
        pending.extend(adjacency.get(current, ()))
    return False


def add_relation(
    db: Session,
    *,
    course_id: str,
    source_node_id: str,
    target_node_id: str,
    relation_type: str,
    confidence: float | None = None,
    created_by: str = "phase3-rule",
) -> KnowledgeEdge | None:
    if relation_type not in ALLOWED_RELATIONS or source_node_id == target_node_id:
        return None
    nodes = db.scalars(
        select(KnowledgeNode).where(
            KnowledgeNode.id.in_([source_node_id, target_node_id]),
            KnowledgeNode.course_id == course_id,
        )
    ).all()
    if len(nodes) != 2 or _would_cycle(db, source_node_id, target_node_id):
        return None
    existing = db.scalar(select(KnowledgeEdge).where(
        KnowledgeEdge.source_node_id == source_node_id,
        KnowledgeEdge.target_node_id == target_node_id,
        KnowledgeEdge.relation_type == relation_type,
    ))
    if existing is not None:
        return existing
    edge = KnowledgeEdge(
        course_id=course_id,
        source_node_id=source_node_id,
        target_node_id=target_node_id,
        relation_type=relation_type,
        confidence=confidence,
        created_by=created_by,
    )
    db.add(edge)
    db.flush()
    return edge
