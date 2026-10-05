from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai.deepseek import DeepSeekClient, DeepSeekError
from app.ai.prompts import build_answer_messages
from app.core.config import settings
from app.db.database import get_db
from app.db.models import (
    Course,
    KnowledgeEdge,
    KnowledgeNode,
    Material,
    MaterialPage,
    Note,
    PageBlock,
    ProcessingJob,
    SourceRef,
)
from app.notes.service import NoteEditConflict, list_course_notes, update_note_as_user
from app.retrieval.service import build_context, retrieve
from app.schemas.api import (
    AssistantRequest,
    AssistantResponse,
    AssistantSource,
    CourseCreate,
    CourseRead,
    JobRead,
    KnowledgeEdgeRead,
    KnowledgeGraphRead,
    KnowledgeNodeRead,
    MaterialRead,
    NoteRead,
    NoteRevisionRead,
    NoteUpdate,
    PageRead,
    SourceRefRead,
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


@router.get("/courses/{course_id}/knowledge-graph", response_model=KnowledgeGraphRead)
def get_knowledge_graph(course_id: str, db: Session = Depends(get_db)) -> KnowledgeGraphRead:
    ensure_course(db, course_id)
    nodes = list(
        db.scalars(
            select(KnowledgeNode)
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
        nodes=[KnowledgeNodeRead.model_validate(node) for node in nodes],
        edges=[KnowledgeEdgeRead.model_validate(edge) for edge in edges],
    )


@router.get("/courses/{course_id}/notes", response_model=list[NoteRead])
def get_course_notes(course_id: str, db: Session = Depends(get_db)) -> list[Note]:
    ensure_course(db, course_id)
    return list_course_notes(db, course_id)


@router.get("/notes/{note_id}", response_model=NoteRead)
def get_note(note_id: str, db: Session = Depends(get_db)) -> Note:
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return note


@router.get("/notes/{note_id}/revisions", response_model=list[NoteRevisionRead])
def get_note_revisions(note_id: str, db: Session = Depends(get_db)) -> list[NoteRevisionRead]:
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return [NoteRevisionRead.model_validate(revision) for revision in note.revisions]


@router.get("/notes/{note_id}/sources", response_model=list[SourceRefRead])
def get_note_sources(note_id: str, db: Session = Depends(get_db)) -> list[SourceRefRead]:
    note = db.scalar(
        select(Note)
        .where(Note.id == note_id)
        .options(
            selectinload(Note.source_refs)
            .selectinload(SourceRef.page_block)
            .selectinload(PageBlock.page)
        )
    )
    if note is None:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return [
        SourceRefRead(
            id=source_ref.id,
            page_block_id=source_ref.page_block_id,
            source_type=source_ref.source_type,
            quote=source_ref.quote,
            material_id=source_ref.page_block.page.material_id,
            page_number=source_ref.page_block.page.page_number,
        )
        for source_ref in note.source_refs
    ]


@router.patch("/notes/{note_id}", response_model=NoteRead)
def update_note(note_id: str, payload: NoteUpdate, db: Session = Depends(get_db)) -> Note:
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="笔记不存在")
    try:
        return update_note_as_user(
            db, note, payload.content_markdown, payload.expected_revision_number
        )
    except NoteEditConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/courses/{course_id}/assistant", response_model=AssistantResponse)
def ask_assistant(
    course_id: str,
    payload: AssistantRequest,
    db: Session = Depends(get_db),
) -> AssistantResponse:
    ensure_course(db, course_id)
    chunks = retrieve(
        db,
        course_id=course_id,
        question=payload.question,
        material_id=payload.material_id,
        page_number=payload.page_number,
    )
    if not chunks:
        return AssistantResponse(
            answer="当前课程的已解析页面中没有找到与问题直接匹配的内容。可以尝试更换关键词，或先上传并解析相关课件。",
            sources=[],
        )

    sources = [
        AssistantSource(
            material_id=chunk.material_id,
            lecture_title=chunk.lecture_title,
            page_number=chunk.page_number,
            snippet=chunk.text[:240] or "该页没有可展示的文本",
        )
        for chunk in chunks
    ]
    context = build_context(chunks)
    client = DeepSeekClient()
    if client.configured:
        try:
            response = client.complete_json(
                build_answer_messages(payload.question, context), max_tokens=2400
            )
            answer = str(response.get("answer_markdown") or "").strip()
            if answer:
                return AssistantResponse(answer=answer, sources=sources, mode="deepseek-rag")
        except DeepSeekError:
            pass

    answer = "初版本地检索找到以下课程内容：\n\n" + "\n\n".join(
        f"[第 {source.page_number} 页] {source.snippet}" for source in sources
    )
    return AssistantResponse(answer=answer, sources=sources, mode="local-retrieval-fallback")


def ensure_course(db: Session, course_id: str) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="课程不存在")
    return course
