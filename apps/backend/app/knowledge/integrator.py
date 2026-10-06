"""Small integration facade used by parsing workers and offline evaluation."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import KnowledgeProposal
from app.knowledge.matcher import classify_match, find_candidates, normalize_name
from app.knowledge.proposals import create_knowledge_proposal


def propose_candidate(
    db: Session,
    *,
    course_id: str,
    material_id: str | None,
    name: str,
    summary: str,
    source_ids: list[str],
) -> KnowledgeProposal:
    candidates = find_candidates(db, course_id=course_id, name=name, summary=summary)
    best = candidates[0] if candidates else None
    exact = bool(best and normalize_name(best.node.name) == normalize_name(name))
    kind, reason = classify_match(best.score if best else 0.0, exact_name=exact)
    status = "auto_applied" if kind == "repeat" else "pending"
    return create_knowledge_proposal(
        db,
        course_id=course_id,
        material_id=material_id,
        candidate_name=name,
        candidate_summary=summary,
        kind=kind,
        confidence=best.score if best else 0.0,
        rationale=reason + (f"；候选节点：{best.node.name}" if best else "；课程中暂无相似节点"),
        source_ids=source_ids,
        target_node_id=best.node.id if best and kind != "new" else None,
        status=status,
        proposed_delta={"summary": summary},
    )
