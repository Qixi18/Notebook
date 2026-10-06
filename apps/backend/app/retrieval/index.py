"""Rebuildable derived retrieval index entry points."""

from __future__ import annotations

import argparse
import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Material, RetrievalChunk
from app.retrieval.service import index_material


def rebuild_material_index(db: Session, material_id: str) -> int:
    """Recreate derived chunks while leaving source pages and notes untouched."""
    material = db.get(Material, material_id)
    if material is None:
        return 0
    # index_material updates active blocks and keeps stale chunks harmlessly addressable.
    index_material(db, material_id)
    return int(db.scalar(select(func.count(RetrievalChunk.id)).where(RetrievalChunk.course_id == material.course_id)) or 0)


def rebuild_course_index(db: Session, course_id: str) -> dict[str, int]:
    materials = list(db.scalars(select(Material).where(Material.course_id == course_id, Material.deleted_at.is_(None))).all())
    for material in materials:
        index_material(db, material.id)
    return {"materials": len(materials), "chunks": int(db.scalar(
        select(func.count(RetrievalChunk.id)).where(RetrievalChunk.course_id == course_id)
    ) or 0)}


def main() -> None:
    from app.db.database import SessionLocal

    parser = argparse.ArgumentParser(description="Rebuild derived NoteBuddy retrieval chunks")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--course-id")
    group.add_argument("--material-id")
    args = parser.parse_args()
    with SessionLocal() as db:
        result = (
            rebuild_course_index(db, args.course_id)
            if args.course_id
            else {"chunks": rebuild_material_index(db, args.material_id)}
        )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
