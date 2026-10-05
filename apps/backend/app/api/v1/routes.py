from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.db.models import Course, Material, MaterialPage, ProcessingJob
from app.schemas.api import (
    AssistantRequest,
    AssistantResponse,
    AssistantSource,
    CourseCreate,
    CourseRead,
    JobRead,
    MaterialRead,
    PageRead,
    UploadMaterialResponse,
)
from app.workers.material_worker import process_material

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "notebook-backend"}


@router.post("/courses", response_model=CourseRead, status_code=201)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)) -> Course:
    course = Course(name=payload.name.strip(), description=payload.description)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/courses", response_model=list[CourseRead])
def list_courses(db: Session = Depends(get_db)) -> list[Course]:
    return list(db.scalars(select(Course).order_by(Course.created_at.desc())).all())


@router.get("/courses/{course_id}/materials", response_model=list[MaterialRead])
def list_materials(course_id: str, db: Session = Depends(get_db)) -> list[Material]:
    ensure_course(db, course_id)
    return list(
        db.scalars(
            select(Material)
            .where(Material.course_id == course_id)
            .order_by(Material.created_at.desc())
        ).all()
    )


@router.post(
    "/courses/{course_id}/materials", response_model=UploadMaterialResponse, status_code=201
)
def upload_material(
    course_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lecture_title: str = Form(...),
    db: Session = Depends(get_db),
) -> UploadMaterialResponse:
    ensure_course(db, course_id)
    original_filename = Path(file.filename or "upload").name
    extension = Path(original_filename).suffix.lower()
    if extension not in settings.allowed_extensions:
        raise HTTPException(status_code=415, detail="初版目前只支持 PPTX 文件")

    from app.db.models import new_id

    material_id = new_id()
    stored_filename = f"{material_id}{extension}"
    destination = settings.originals_dir / stored_filename
    size_bytes = 0
    try:
        with destination.open("wb") as output:
            while chunk := file.file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > settings.max_upload_bytes:
                    raise HTTPException(status_code=413, detail="文件超过本地配置的大小限制")
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise

    material = Material(
        id=material_id,
        course_id=course_id,
        lecture_title=lecture_title.strip()[:200] or original_filename,
        original_filename=original_filename[:255],
        stored_filename=stored_filename,
        media_type=file.content_type,
        size_bytes=size_bytes,
        status="pending",
    )
    job = ProcessingJob(material_id=material_id, kind="parse_material")
    db.add(material)
    db.add(job)
    db.commit()
    db.refresh(material)
    db.refresh(job)
    background_tasks.add_task(process_material, job.id)
    return UploadMaterialResponse(material=material, job=job)


@router.get("/jobs/{job_id}", response_model=JobRead)
def get_job(job_id: str, db: Session = Depends(get_db)) -> ProcessingJob:
    job = db.get(ProcessingJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return job


@router.get("/materials/{material_id}/pages", response_model=list[PageRead])
def list_material_pages(material_id: str, db: Session = Depends(get_db)) -> list[MaterialPage]:
    if db.get(Material, material_id) is None:
        raise HTTPException(status_code=404, detail="资料不存在")
    return list(
        db.scalars(
            select(MaterialPage)
            .where(MaterialPage.material_id == material_id)
            .order_by(MaterialPage.page_number)
        ).all()
    )


@router.post("/courses/{course_id}/assistant", response_model=AssistantResponse)
def ask_assistant(
    course_id: str,
    payload: AssistantRequest,
    db: Session = Depends(get_db),
) -> AssistantResponse:
    ensure_course(db, course_id)
    pages_query = (
        select(MaterialPage, Material)
        .join(Material, MaterialPage.material_id == Material.id)
        .where(Material.course_id == course_id)
    )
    if payload.material_id:
        pages_query = pages_query.where(Material.id == payload.material_id)
    if payload.page_number:
        pages_query = pages_query.where(MaterialPage.page_number == payload.page_number)

    terms = [
        term.lower()
        for term in re.findall(r"[\w\u4e00-\u9fff]+", payload.question)
        if len(term) > 1
    ]
    scored: list[tuple[int, MaterialPage, Material]] = []
    for page, material in db.execute(pages_query).all():
        haystack = page.raw_text.lower()
        score = sum(haystack.count(term) for term in terms)
        if score > 0:
            scored.append((score, page, material))
    scored.sort(key=lambda item: item[0], reverse=True)
    top_results = scored[:3]
    if not top_results:
        return AssistantResponse(
            answer="初版本地检索没有在当前课程的已解析页面中找到直接匹配内容。后续将接入 Embedding、知识树检索和模型回答。",
            sources=[],
        )

    sources = [
        AssistantSource(
            material_id=material.id,
            lecture_title=material.lecture_title,
            page_number=page.page_number,
            snippet=(page.raw_text[:240] or "该页没有可展示的文本"),
        )
        for _, page, material in top_results
    ]
    answer = "初版本地检索找到以下课程内容：\n\n" + "\n\n".join(
        f"第 {source.page_number} 页：{source.snippet}" for source in sources
    )
    return AssistantResponse(answer=answer, sources=sources)


def ensure_course(db: Session, course_id: str) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    return course
