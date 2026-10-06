from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.shared import ensure_course, ensure_material
from app.core.config import settings
from app.db.database import get_db
from app.db.models import (
    Material,
    MaterialPage,
    ProcessingJob,
    WebSource,
)
from app.schemas.api import (
    DeletionPreview,
    JobRead,
    MaterialRead,
    PageRead,
    UploadMaterialResponse,
    WebSourceRead,
)
from app.services.deletion import (
    DeletionConflict,
    impact_preview,
    soft_delete_material,
)
from app.services.uploads import UploadRejected, ingest_pptx

router = APIRouter()


@router.get("/courses/{course_id}/materials", response_model=list[MaterialRead])
def list_materials(course_id: str, db: Session = Depends(get_db)) -> list[Material]:
    ensure_course(db, course_id)
    return list(
        db.scalars(
            select(Material)
            .where(Material.course_id == course_id, Material.deleted_at.is_(None))
            .order_by(Material.created_at.desc())
        ).all()
    )



@router.get("/courses/{course_id}/deleted-materials", response_model=list[MaterialRead])
def list_deleted_materials(course_id: str, db: Session = Depends(get_db)) -> list[Material]:
    ensure_course(db, course_id)
    return list(db.scalars(select(Material).where(
        Material.course_id == course_id, Material.deleted_at.is_not(None)
    ).order_by(Material.deleted_at.desc())).all())



@router.get("/materials/{material_id}/deletion-preview", response_model=DeletionPreview)
def preview_material_deletion(material_id: str, db: Session = Depends(get_db)) -> dict:
    material = ensure_material(db, material_id)
    return impact_preview(db, course_id=material.course_id, material_id=material.id)



@router.delete("/materials/{material_id}", response_model=DeletionPreview)
def delete_material(material_id: str, db: Session = Depends(get_db)) -> dict:
    material = ensure_material(db, material_id)
    try:
        return soft_delete_material(db, material)
    except DeletionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc



@router.post("/materials/{material_id}/restore", response_model=MaterialRead)
def restore_material(material_id: str, db: Session = Depends(get_db)) -> Material:
    material = db.get(Material, material_id)
    if material is None or material.deleted_at is None:
        raise HTTPException(status_code=404, detail="待恢复资料不存在")
    ensure_course(db, material.course_id)
    material.deleted_at = None
    db.commit()
    db.refresh(material)
    return material



@router.post(
    "/courses/{course_id}/materials", response_model=UploadMaterialResponse, status_code=201
)
def upload_material(
    course_id: str,
    file: UploadFile = File(...),
    lecture_title: str = Form(...),
    topic_title: str = Form(default=""),
    allow_duplicate: bool = Form(default=False),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
) -> UploadMaterialResponse:
    ensure_course(db, course_id)
    try:
        material, job = ingest_pptx(
            db, course_id=course_id, source=file.file,
            filename=file.filename or "upload", lecture_title=lecture_title,
            topic_title=topic_title, media_type=file.content_type,
            allow_duplicate=allow_duplicate, idempotency_key=idempotency_key,
        )
    except UploadRejected as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return UploadMaterialResponse(material=material, job=job)



@router.post("/materials/{material_id}/retry", response_model=JobRead, status_code=202)
def retry_material(material_id: str, db: Session = Depends(get_db)) -> ProcessingJob:
    material = ensure_material(db, material_id)
    if material.status != "failed":
        raise HTTPException(status_code=409, detail="只有解析失败的资料可以重试")
    if not (settings.originals_dir / material.stored_filename).is_file():
        raise HTTPException(status_code=410, detail="原始课件文件不存在，请重新上传")
    material.status = "pending"
    job = ProcessingJob(material_id=material.id, kind="parse_material")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job



@router.get("/materials/{material_id}/pages", response_model=list[PageRead])
def list_material_pages(material_id: str, db: Session = Depends(get_db)) -> list[MaterialPage]:
    ensure_material(db, material_id)
    return list(
        db.scalars(
            select(MaterialPage)
            .where(MaterialPage.material_id == material_id)
            .order_by(MaterialPage.page_number)
        ).all()
    )



@router.get("/materials/{material_id}/latest-job", response_model=JobRead)
def get_latest_material_job(material_id: str, db: Session = Depends(get_db)) -> ProcessingJob:
    ensure_material(db, material_id)
    job = db.scalar(select(ProcessingJob).where(ProcessingJob.material_id == material_id).order_by(ProcessingJob.created_at.desc()).limit(1))
    if job is None:
        raise HTTPException(status_code=404, detail="资料没有处理任务")
    return job



@router.get("/courses/{course_id}/web-sources", response_model=list[WebSourceRead])
def list_course_web_sources(course_id: str, db: Session = Depends(get_db)) -> list[WebSource]:
    ensure_course(db, course_id)
    return list(db.scalars(select(WebSource).where(WebSource.course_id == course_id).order_by(WebSource.retrieved_at.desc())).all())



@router.get("/materials/{material_id}/web-sources", response_model=list[WebSourceRead])
def list_material_web_sources(material_id: str, db: Session = Depends(get_db)) -> list[WebSource]:
    ensure_material(db, material_id)
    return list(db.scalars(select(WebSource).where(WebSource.material_id == material_id).order_by(WebSource.retrieved_at.desc())).all())
