from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai.deepseek import DeepSeekClient, DeepSeekError
from app.ai.prompts import build_note_extraction_messages
from app.db.models import (
    KnowledgeEdge,
    KnowledgeNode,
    Material,
    MaterialPage,
    Note,
    NoteRevision,
    NoteSourceMapping,
    PageBlock,
    SourceRef,
)
from app.notes.renderer import render_note_markdown

ALLOWED_RELATIONS = {"related", "prerequisite", "deepens"}


def extract_material_knowledge(db: Session, material_id: str) -> list[KnowledgeNode]:
    material = db.scalar(
        select(Material)
        .where(Material.id == material_id)
    )
    if material is None:
        return []

    pages = list(db.scalars(
        select(MaterialPage)
        .where(MaterialPage.material_id == material_id, MaterialPage.is_active.is_(True))
        .options(selectinload(MaterialPage.blocks))
        .order_by(MaterialPage.page_number, MaterialPage.id)
    ).all())

    created_or_updated: list[KnowledgeNode] = []
    for page in pages:
        if not page.raw_text.strip():
            continue

        source_refs = ensure_source_refs(db, page.blocks, parser_version=material.parser_version)
        draft = extract_page_draft(page.title or f"第 {page.page_number} 页", page.raw_text)
        title = clean_title(str(draft.get("title") or page.title or f"第 {page.page_number} 页"))
        node = db.scalar(
            select(KnowledgeNode).where(
                KnowledgeNode.course_id == material.course_id,
                KnowledgeNode.name == title,
            )
        )
        if node is None:
            node = KnowledgeNode(course_id=material.course_id, name=title)
            db.add(node)
            db.flush()

        node.summary = str(draft.get("summary") or "").strip() or node.summary
        add_unique_sources(node.source_refs, source_refs)
        note_content = render_note_markdown(
            title=title,
            summary=str(draft.get("summary") or "").strip(),
            key_points=as_text_list(draft.get("key_points")),
            methods=as_text_list(draft.get("methods")),
            formulas=as_text_list(draft.get("formulas")),
            source_refs=source_refs,
        )
        ensure_note(db, material.course_id, node, note_content, source_refs)
        ensure_relations(db, material.course_id, node, draft.get("relations"))
        created_or_updated.append(node)

    return created_or_updated


def ensure_source_refs(
    db: Session, blocks: Iterable[PageBlock], *, parser_version: str | None = None
) -> list[SourceRef]:
    refs: list[SourceRef] = []
    for block in blocks:
        if not block.content.strip():
            continue
        source_ref = db.scalar(
            select(SourceRef).where(
                SourceRef.page_block_id == block.id,
                SourceRef.source_type == "course_material",
                SourceRef.status == "active",
            )
        )
        if source_ref is None:
            source_ref = SourceRef(
                page_block_id=block.id,
                source_type="course_material",
                quote=block.content[:1000],
                target_label=block.location_label or block.page.location_label,
                parser_version=parser_version,
            )
            db.add(source_ref)
            db.flush()
        refs.append(source_ref)
    return refs


def extract_page_draft(title: str, text: str) -> dict[str, Any]:
    client = DeepSeekClient()
    if client.configured:
        try:
            draft = client.complete_json(
                build_note_extraction_messages(title, text[:12000]), max_tokens=2400
            )
            if isinstance(draft, dict):
                return draft
        except DeepSeekError:
            pass
    return fallback_page_draft(title, text)


def fallback_page_draft(title: str, text: str) -> dict[str, Any]:
    lines = [line.strip(" -•\t") for line in text.splitlines() if line.strip()]
    body = lines[1:] if len(lines) > 1 else lines
    return {
        "title": title,
        "summary": body[0][:300] if body else "该页面已被解析，但没有足够文本生成摘要。",
        "key_points": body[:5],
        "methods": [],
        "formulas": [],
        "relations": [],
    }


def ensure_note(
    db: Session,
    course_id: str,
    node: KnowledgeNode,
    content: str,
    source_refs: list[SourceRef],
) -> Note:
    note = node.note
    if note is None:
        note = Note(
            course_id=course_id,
            knowledge_node_id=node.id,
            title=node.name,
            content_markdown=content,
            content_origin="ai",
            user_locked=False,
            revision_number=1,
        )
        db.add(note)
        db.flush()
        db.add(
            NoteRevision(
                note_id=note.id,
                revision_number=1,
                content_markdown=content,
                content_origin="ai",
                user_locked=False,
            )
        )
    elif not note.user_locked and note.content_markdown != content:
        _, separator, previous_web_references = note.content_markdown.partition("\n\n## 网络拓展阅读（外部来源）\n")
        note.content_markdown = content + (separator + "## 网络拓展阅读（外部来源）\n" + previous_web_references if separator else "")
        note.content_origin = "ai_web_augmented" if separator else "ai"
        note.revision_number += 1
        db.add(
            NoteRevision(
                note_id=note.id,
                revision_number=note.revision_number,
                content_markdown=content,
                content_origin="ai",
                user_locked=False,
            )
        )
    add_unique_sources(note.source_refs, source_refs)
    existing = {
        (mapping.note_id, mapping.source_ref_id, mapping.fragment_key)
        for mapping in db.scalars(
            select(NoteSourceMapping).where(NoteSourceMapping.note_id == note.id)
        ).all()
    }
    for source_ref in source_refs:
        key = (note.id, source_ref.id, "whole-note")
        if key not in existing:
            db.add(NoteSourceMapping(
                note_id=note.id,
                source_ref_id=source_ref.id,
                fragment_key="whole-note",
                citation_type="whole_note",
                status=source_ref.status,
                parser_version=source_ref.parser_version,
            ))
    return note


def ensure_relations(
    db: Session,
    course_id: str,
    node: KnowledgeNode,
    raw_relations: object,
) -> None:
    if not isinstance(raw_relations, list):
        return
    for relation in raw_relations:
        if not isinstance(relation, dict):
            continue
        relation_type = str(relation.get("relation_type") or "").strip()
        target_name = clean_title(str(relation.get("target_name") or ""))
        if relation_type not in ALLOWED_RELATIONS or not target_name or target_name == node.name:
            continue
        target = db.scalar(
            select(KnowledgeNode).where(
                KnowledgeNode.course_id == course_id,
                KnowledgeNode.name == target_name,
            )
        )
        if target is None:
            continue
        existing = db.scalar(
            select(KnowledgeEdge).where(
                KnowledgeEdge.source_node_id == node.id,
                KnowledgeEdge.target_node_id == target.id,
                KnowledgeEdge.relation_type == relation_type,
            )
        )
        if existing is None:
            confidence = relation.get("confidence")
            db.add(
                KnowledgeEdge(
                    course_id=course_id,
                    source_node_id=node.id,
                    target_node_id=target.id,
                    relation_type=relation_type,
                    confidence=float(confidence) if isinstance(confidence, (int, float)) else None,
                    created_by="deepseek" if DeepSeekClient().configured else "fallback",
                )
            )


def add_unique_sources(target: list[SourceRef], incoming: Iterable[SourceRef]) -> None:
    existing_ids = {item.id for item in target}
    for source_ref in incoming:
        if source_ref.id not in existing_ids:
            target.append(source_ref)
            existing_ids.add(source_ref.id)


def as_text_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def clean_title(value: str) -> str:
    return " ".join(value.strip().split())[:300] or "未命名知识点"
