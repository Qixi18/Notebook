"""Compute page/section coverage from current note-to-source facts."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import MaterialPage, PageBlock, SourceRef


def material_coverage(db: Session, material_id: str) -> dict:
    pages = list(db.scalars(
        select(MaterialPage)
        .where(MaterialPage.material_id == material_id, MaterialPage.is_active.is_(True))
        .options(selectinload(MaterialPage.blocks).selectinload(PageBlock.source_refs).selectinload(SourceRef.notes))
        .order_by(MaterialPage.page_number, MaterialPage.id)
    ).all())
    locations: list[dict] = []
    for page in pages:
        notes: dict[str, str] = {}
        citation_count = 0
        for block in page.blocks:
            for source in block.source_refs:
                if source.status != "active":
                    continue
                for note in source.notes:
                    notes[note.id] = note.title
                    citation_count += 1
        locations.append({
            "page_id": page.id,
            "page_number": page.page_number,
            "location_type": page.location_type,
            "location_label": page.location_label or f"第 {page.page_number} 页",
            "stable_location_key": page.stable_location_key,
            "status": "cited" if citation_count else "review",
            "citation_count": citation_count,
            "note_ids": sorted(notes),
            "note_titles": [notes[key] for key in sorted(notes)],
            "warning": page.warning,
        })
    cited = sum(item["status"] == "cited" for item in locations)
    return {
        "material_id": material_id,
        "total_locations": len(locations),
        "cited_locations": cited,
        "review_locations": len(locations) - cited,
        "locations": locations,
    }
