from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.shared import ensure_material
from app.db.database import get_db
from app.db.models import (
    ProcessingJob,
)
from app.schemas.api import (
    JobRead,
)

router = APIRouter()


@router.get("/jobs/{job_id}", response_model=JobRead)
def get_job(job_id: str, db: Session = Depends(get_db)) -> ProcessingJob:
    job = db.get(ProcessingJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    ensure_material(db, job.material_id)
    return job
