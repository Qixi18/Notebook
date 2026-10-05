from __future__ import annotations

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import MaterialPage, PageBlock, ProcessingJob
from app.parsers.pptx_parser import parse_pptx


def process_material(job_id: str) -> None:
    db = SessionLocal()
    job = None
    try:
        job = db.get(ProcessingJob, job_id)
        if job is None:
            return
        material = job.material
        job.status = "processing"
        job.progress = 5
        material.status = "processing"
        db.commit()

        source_path = settings.originals_dir / material.stored_filename
        if source_path.suffix.lower() != ".pptx":
            raise ValueError("初版解析器目前只支持 .pptx，PDF 和 DOCX 将在后续版本接入")

        parsed_pages = parse_pptx(source_path)
        material.pages.clear()
        material.page_count = len(parsed_pages)

        for index, parsed_page in enumerate(parsed_pages, start=1):
            page = MaterialPage(
                material_id=material.id,
                page_number=parsed_page["page_number"],
                title=parsed_page["title"],
                raw_text=parsed_page["raw_text"],
                warning=parsed_page["warning"],
            )
            db.add(page)
            db.flush()
            for block in parsed_page["blocks"]:
                db.add(
                    PageBlock(
                        page_id=page.id,
                        block_type=block["block_type"],
                        content=block["content"],
                        position=block["position"],
                        font_size=block["font_size"],
                        is_bold=block["is_bold"],
                    )
                )
            job.progress = max(5, int(index / max(len(parsed_pages), 1) * 95))
            db.commit()

        material.status = "completed"
        job.status = "completed"
        job.progress = 100
        db.commit()
    except Exception as exc:
        db.rollback()
        if job is None:
            job = db.get(ProcessingJob, job_id)
        if job is not None:
            job.status = "failed"
            job.error_message = str(exc)
            job.progress = 0
            if job.material is not None:
                job.material.status = "failed"
            db.commit()
    finally:
        db.close()
