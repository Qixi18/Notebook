from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.shared import ensure_course
from app.db.database import get_db
from app.db.models import Feedback
from app.schemas.api import FeedbackCreate, FeedbackRead, FeedbackUpdate
from app.services.feedback import save_feedback

router = APIRouter()


@router.post("/courses/{course_id}/feedback", response_model=FeedbackRead, status_code=201)
def create_feedback(course_id: str, payload: FeedbackCreate, db: Session = Depends(get_db)) -> Feedback:
    ensure_course(db, course_id)
    try:
        feedback = save_feedback(
            db, course_id=course_id, target_type=payload.target_type,
            target_id=payload.target_id, category=payload.category, comment=payload.comment,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/courses/{course_id}/feedback", response_model=list[FeedbackRead])
def list_feedback(course_id: str, status: str | None = None, db: Session = Depends(get_db)) -> list[Feedback]:
    ensure_course(db, course_id)
    query = select(Feedback).where(Feedback.course_id == course_id)
    if status:
        query = query.where(Feedback.status == status)
    return list(db.scalars(query.order_by(Feedback.created_at.desc())).all())


@router.patch("/courses/{course_id}/feedback/{feedback_id}", response_model=FeedbackRead)
def update_feedback(
    course_id: str,
    feedback_id: str,
    payload: FeedbackUpdate,
    db: Session = Depends(get_db),
) -> Feedback:
    ensure_course(db, course_id)
    feedback = db.scalar(select(Feedback).where(
        Feedback.id == feedback_id,
        Feedback.course_id == course_id,
    ))
    if feedback is None:
        raise HTTPException(status_code=404, detail="反馈记录不存在")
    feedback.status = payload.status
    feedback.resolution = payload.resolution
    db.commit()
    db.refresh(feedback)
    return feedback
