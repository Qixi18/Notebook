"""Source lifecycle helpers shared by parsing, evidence and reparse jobs."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import MaterialPage, NoteSourceMapping, PageBlock, SourceRef


def mark_pages_stale(db: Session, pages: Iterable[MaterialPage]) -> int:
    """Keep old evidence rows but make them ineligible for current coverage."""
    block_ids = [block.id for page in pages for block in page.blocks]
    if not block_ids:
        return 0
    source_ids = list(db.scalars(
        select(SourceRef.id).where(SourceRef.page_block_id.in_(block_ids))
    ).all())
    if not source_ids:
        return 0
    db.execute(
        update(SourceRef)
        .where(SourceRef.id.in_(source_ids))
        .values(status="stale")
    )
    db.execute(
        update(NoteSourceMapping)
        .where(NoteSourceMapping.source_ref_id.in_(source_ids))
        .values(status="stale")
    )
    return len(source_ids)


def active_page_query(material_id: str):
    """Return the canonical predicate for the current parse version."""
    return select(MaterialPage).where(
        MaterialPage.material_id == material_id,
        MaterialPage.is_active.is_(True),
    )


def active_block_query(material_id: str):
    return (
        select(PageBlock)
        .join(MaterialPage, PageBlock.page_id == MaterialPage.id)
        .where(
            MaterialPage.material_id == material_id,
            MaterialPage.is_active.is_(True),
            PageBlock.content != "",
        )
    )
