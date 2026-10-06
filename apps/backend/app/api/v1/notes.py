from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.shared import ensure_course, ensure_material, ensure_note
from app.db.database import get_db
from app.db.models import (
    Note,
    PageBlock,
    SourceRef,
    WebSource,
)
from app.notes.service import NoteEditConflict, list_course_notes, update_note_as_user
from app.schemas.api import (
    NoteRead,
    NoteRevisionRead,
    NoteUpdate,
    SourceRefRead,
    WebSourceRead,
)

router = APIRouter()


def _source_ref_read(source_ref: SourceRef) -> SourceRefRead:
    page = source_ref.page_block.page
    return SourceRefRead(
        id=source_ref.id,
        page_block_id=source_ref.page_block_id,
        source_type=source_ref.source_type,
        quote=source_ref.quote,
        material_id=page.material_id,
        page_number=page.page_number,
        location_type=page.location_type,
        location_label=page.location_label or source_ref.target_label,
        status=source_ref.status,
        target_label=source_ref.target_label,
    )


@router.get("/courses/{course_id}/notes", response_model=list[NoteRead])
def get_course_notes(course_id: str, db: Session = Depends(get_db)) -> list[Note]:
    ensure_course(db, course_id)
    return list_course_notes(db, course_id)



@router.get("/notes/{note_id}", response_model=NoteRead)
def get_note(note_id: str, db: Session = Depends(get_db)) -> Note:
    return ensure_note(db, note_id)



@router.get("/notes/{note_id}/revisions", response_model=list[NoteRevisionRead])
def get_note_revisions(note_id: str, db: Session = Depends(get_db)) -> list[NoteRevisionRead]:
    note = ensure_note(db, note_id)
    return [NoteRevisionRead.model_validate(revision) for revision in note.revisions]



@router.get("/notes/{note_id}/web-sources", response_model=list[WebSourceRead])
def get_note_web_sources(note_id: str, db: Session = Depends(get_db)) -> list[WebSource]:
    note = ensure_note(db, note_id)
    return list(db.scalars(select(WebSource).where(WebSource.knowledge_node_id == note.knowledge_node_id).order_by(WebSource.retrieved_at.desc())).all())



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
    ensure_course(db, note.course_id)
    return [_source_ref_read(source_ref) for source_ref in note.source_refs]


@router.get("/sources/{source_ref_id}", response_model=SourceRefRead)
def get_source(source_ref_id: str, db: Session = Depends(get_db)) -> SourceRefRead:
    source_ref = db.scalar(
        select(SourceRef)
        .where(SourceRef.id == source_ref_id)
        .options(selectinload(SourceRef.page_block).selectinload(PageBlock.page))
    )
    if source_ref is None:
        raise HTTPException(status_code=404, detail="来源不存在")
    ensure_material(db, source_ref.page_block.page.material_id)
    return _source_ref_read(source_ref)



@router.patch("/notes/{note_id}", response_model=NoteRead)
def update_note(note_id: str, payload: NoteUpdate, db: Session = Depends(get_db)) -> Note:
    note = ensure_note(db, note_id)
    try:
        return update_note_as_user(
            db, note, payload.content_markdown, payload.expected_revision_number
        )
    except NoteEditConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
