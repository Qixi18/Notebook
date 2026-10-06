from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import (
    KnowledgeNode,
    MaterialPage,
    NoteRevision,
    PageBlock,
    ProcessingJob,
    SourceRef,
    WebSource,
)
from app.knowledge.extractor import extract_material_knowledge
from app.parsers.document import parse_document
from app.retrieval.service import index_material
from app.web_search.tavily import WebSearchError
from app.web_search.tavily import configured as web_search_configured
from app.web_search.tavily import search as web_search


def process_material(job_id: str) -> None:
    db = SessionLocal()
    job = None
    try:
        job = db.get(ProcessingJob, job_id)
        if job is None or job.status != "processing":
            return
        material = job.material
        job.status = "processing"
        job.phase = "parse"
        job.web_search_status = "waiting" if web_search_configured() else "unavailable"
        job.progress = 5
        job.heartbeat_at = datetime.now(UTC)
        material.status = "processing"
        db.commit()

        source_path = settings.originals_dir / material.stored_filename
        if source_path.suffix.lower() not in settings.allowed_extensions:
            raise ValueError("该资料格式未启用解析器")

        # A retry after knowledge/index failure reuses committed pages and
        # their SourceRef IDs. Replacing them would destroy note provenance.
        if not material.pages or material.page_count != len(material.pages):
            parsed_document = parse_document(source_path)
            parsed_pages = parsed_document.pages
            material.pages.clear()
            material.page_count = len(parsed_pages)
            material.parser_version = parsed_document.parser_version
            material.document_warning = "；".join(parsed_document.warnings) or None
            for index, parsed_page in enumerate(parsed_pages, start=1):
                page = MaterialPage(
                    material_id=material.id,
                    page_number=parsed_page.page_number,
                    title=parsed_page.title,
                    raw_text=parsed_page.raw_text,
                    parse_status=parsed_page.parse_status,
                    warning=parsed_page.warning,
                    location_type=parsed_page.location_type,
                    location_label=parsed_page.location_label,
                    stable_location_key=parsed_page.stable_location_key,
                    extraction_method=parsed_page.extraction_method,
                    confidence=parsed_page.confidence,
                )
                db.add(page)
                db.flush()
                for block in parsed_page.blocks:
                    db.add(
                        PageBlock(
                            page_id=page.id,
                            block_type=block.block_type,
                            content=block.content,
                            position=block.position,
                            font_size=block.font_size,
                            is_bold=block.is_bold,
                            object_id=block.object_id,
                            location_label=block.location_label,
                            extraction_method=block.extraction_method,
                            confidence=block.confidence,
                            warning=block.warning,
                        )
                    )
                job.progress = max(5, int(index / max(len(parsed_pages), 1) * 95))
        # The parsed page set becomes visible together; an interruption cannot
        # leave a half-parsed material that the next run mistakes for complete.
        job.heartbeat_at = datetime.now(UTC)
        db.commit()

        job.progress = 96
        job.phase = "knowledge"
        job.heartbeat_at = datetime.now(UTC)
        db.commit()
        extract_material_knowledge(db, material.id)
        if web_search_configured():
            job.phase = "web_search"
            job.heartbeat_at = datetime.now(UTC)
            job.web_search_status = "processing"
            job.progress = 97
            db.commit()
            nodes = list(db.scalars(
                select(KnowledgeNode).distinct()
                .join(KnowledgeNode.source_refs)
                .join(SourceRef.page_block)
                .join(PageBlock.page)
                .where(KnowledgeNode.course_id == material.course_id, MaterialPage.material_id == material.id)
            ).all())
            found = 0
            try:
                for node in nodes[:8]:
                    node_sources: list[WebSource] = []
                    for result in web_search(f"{node.name} {material.lecture_title}", max_results=2):
                        if result.get("score") is not None and result["score"] < 0.35:
                            continue
                        existing = db.scalar(select(WebSource).where(WebSource.material_id == material.id, WebSource.url == result["url"]))
                        if existing:
                            continue
                        source = WebSource(course_id=material.course_id, material_id=material.id, knowledge_node_id=node.id, search_query=f"{node.name} {material.lecture_title}", **result)
                        db.add(source)
                        db.flush()
                        node_sources.append(source)
                        found += 1
                    if node_sources and node.note is not None and not node.note.user_locked:
                        append_web_references(db, node.note, node_sources)
                job.web_search_status = "completed" if found else "no_results"
                db.commit()
            except WebSearchError as exc:
                db.rollback()
                job = db.get(ProcessingJob, job_id)
                job.web_search_status = "failed"
                job.error_message = f"课件解析已完成；联网检索失败：{exc}"
                db.commit()
        job.phase = "index"
        job.heartbeat_at = datetime.now(UTC)
        job.progress = 98
        db.commit()
        index_material(db, material.id)
        material.status = "completed"
        job.status = "completed"
        job.phase = "completed"
        job.progress = 100
        job.finished_at = datetime.now(UTC)
        db.commit()
    except Exception as exc:
        db.rollback()
        if job is None:
            job = db.get(ProcessingJob, job_id)
        if job is not None:
            job.status = "failed"
            job.phase = "failed"
            job.error_message = str(exc)
            job.error_code = "processing_failed"
            job.finished_at = datetime.now(UTC)
            job.progress = 0
            if job.material is not None:
                job.material.status = "failed"
            db.commit()
    finally:
        db.close()


def append_web_references(db, note, sources: list[WebSource]) -> None:
    additions = [source for source in sources if source.url not in note.content_markdown]
    if not additions:
        return
    references = []
    for source in additions:
        safe_title = source.title.replace("]", "\\]")
        snippet = source.snippet[:400].replace("\n", " ")
        references.append(f"- [{safe_title}]({source.url}) · {source.site_name} · 检索于 {source.retrieved_at:%Y-%m-%d}\n  > {snippet}")
    section = "\n\n## 网络拓展阅读（外部来源）\n" + "\n\n".join(references)
    note.content_markdown = note.content_markdown.rstrip() + section
    note.content_origin = "ai_web_augmented"
    note.revision_number += 1
    db.add(NoteRevision(
        note_id=note.id,
        revision_number=note.revision_number,
        content_markdown=note.content_markdown,
        content_origin="ai_web_augmented",
        user_locked=False,
    ))
