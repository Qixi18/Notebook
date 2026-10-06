from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.shared import ensure_course
from app.db.database import get_db
from app.schemas.api import TermExplanationRequest, TermExplanationResponse

router = APIRouter()


@router.post("/courses/{course_id}/terms/explain", response_model=TermExplanationResponse)
def explain_term(
    course_id: str, payload: TermExplanationRequest, db: Session = Depends(get_db)
) -> TermExplanationResponse:
    ensure_course(db, course_id)
    term = payload.term.strip()
    return TermExplanationResponse(
        original=term,
        common_translations=[],
        discipline=payload.discipline,
        explanation=(
            "当前未配置可核验的术语解释服务；请把该词放回课程原文中理解，"
            "不要把未有出处的词源或类比当成学术定义。"
        ),
        source_note="通用解释；本地没有匹配到可引用的课程来源。",
        uncertain=True,
    )
