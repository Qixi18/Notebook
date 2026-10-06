from __future__ import annotations

import re
import unicodedata
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
    PageBlock,
    SourceRef,
)
from app.notes.renderer import render_note_markdown

ALLOWED_RELATIONS = {"related", "prerequisite", "deepens"}


def extract_material_knowledge(db: Session, material_id: str) -> list[KnowledgeNode]:
    """把一份资料解析成知识点、笔记与它们之间的关系。

    分两遍处理，原因是关系生成本质上需要「全局视图」：
    第 1 页提到的知识点可能在第 40 页才被建立。若边建节点边连边，
    后出现的节点当时还不存在，关系会被静默丢弃——这正是早期版本
    `knowledge_edges` 恒为 0 的原因（见 docs/architecture.md）。

    第一遍：逐页提取 draft，建立/更新知识点与笔记，收集待连的关系；
    第二遍：所有节点都已落库，再统一解析关系，跨页引用才能命中。
    """
    material = db.scalar(
        select(Material)
        .where(Material.id == material_id)
        .options(selectinload(Material.pages).selectinload(MaterialPage.blocks))
    )
    if material is None:
        return []

    created_or_updated: list[KnowledgeNode] = []
    # (node, raw_relations)：先记下来，等全部节点建完再连边
    pending_relations: list[tuple[KnowledgeNode, object]] = []

    # ---- 第一遍：建立全部知识点与笔记 ----
    for page in sorted(material.pages, key=lambda item: item.page_number):
        if not page.raw_text.strip():
            continue

        source_refs = ensure_source_refs(db, page.blocks)
        draft = extract_page_draft(page.title or f"第 {page.page_number} 页", page.raw_text)
        title = clean_title(str(draft.get("title") or page.title or f"第 {page.page_number} 页"))
        node = find_or_create_node(db, material.course_id, title)

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
        pending_relations.append((node, draft.get("relations")))
        created_or_updated.append(node)

    # 先落盘，确保第二遍能查询到本次新建的所有节点
    db.flush()

    # ---- 第二遍：统一连边 ----
    for node, raw_relations in pending_relations:
        ensure_relations(db, material.course_id, node, raw_relations)

    return created_or_updated


def find_or_create_node(db: Session, course_id: str, name: str) -> KnowledgeNode:
    """按归一化名称查找知识点，找不到才新建。

    归一化让「矩阵」与「矩阵 」这类仅差空白的标题合并到同一节点，
    避免同一概念被拆成两个孤立节点、关系也因此连不上。
    """
    normalized = normalize_name(name)
    for existing in db.scalars(
        select(KnowledgeNode).where(KnowledgeNode.course_id == course_id)
    ).all():
        if normalize_name(existing.name) == normalized:
            return existing

    node = KnowledgeNode(course_id=course_id, name=name)
    db.add(node)
    db.flush()
    return node


def ensure_source_refs(db: Session, blocks: Iterable[PageBlock]) -> list[SourceRef]:
    refs: list[SourceRef] = []
    for block in blocks:
        source_ref = db.scalar(
            select(SourceRef).where(
                SourceRef.page_block_id == block.id,
                SourceRef.source_type == "course_material",
            )
        )
        if source_ref is None:
            source_ref = SourceRef(
                page_block_id=block.id,
                source_type="course_material",
                quote=block.content[:1000],
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
    """取得（或创建）该知识点的笔记。

    `Note.knowledge_node_id` 有唯一约束，而一个知识点可能在同一批次里
    被多个页面命中（`find_or_create_node` 会复用节点，例如封面页与
    过渡页被归一化成同一个名称）。因此这里**必须直接查库**判断笔记
    是否已存在，不能只信 `node.note` 的关系缓存——节点刚 `flush` 出来时
    缓存可能还未反映真实状态，重复插入会撞唯一约束使整个任务失败。
    """
    note = db.scalar(select(Note).where(Note.knowledge_node_id == node.id))
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
        note.content_markdown = content
        note.content_origin = "ai"
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
    return note


def ensure_relations(
    db: Session,
    course_id: str,
    node: KnowledgeNode,
    raw_relations: object,
) -> None:
    """把 draft 里声明的关系统一落库。

    调用时机很关键：必须在**全部知识点建立之后**执行，否则指向
    尚未出现的节点的关系会被 `continue` 静默丢弃（早期版本即如此）。
    """
    if not isinstance(raw_relations, list):
        return
    for relation in raw_relations:
        if not isinstance(relation, dict):
            continue
        relation_type = str(relation.get("relation_type") or "").strip()
        target_name = clean_title(str(relation.get("target_name") or ""))
        if relation_type not in ALLOWED_RELATIONS or not target_name:
            continue

        target = find_node_by_name(db, course_id, target_name)
        # 目标不存在：可能是模型臆造的概念，跳过而不是凭空建节点
        if target is None or target.id == node.id:
            continue

        existing = db.scalar(
            select(KnowledgeEdge).where(
                KnowledgeEdge.source_node_id == node.id,
                KnowledgeEdge.target_node_id == target.id,
                KnowledgeEdge.relation_type == relation_type,
            )
        )
        if existing is not None:
            continue

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


def find_node_by_name(db: Session, course_id: str, name: str) -> KnowledgeNode | None:
    """按归一化名称查找知识点，命中返回节点，否则 None。"""
    normalized = normalize_name(name)
    if not normalized:
        return None
    for existing in db.scalars(
        select(KnowledgeNode).where(KnowledgeNode.course_id == course_id)
    ).all():
        if normalize_name(existing.name) == normalized:
            return existing
    return None


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


def normalize_name(value: str) -> str:
    """归一化知识点名称，用于跨页/跨讲的同概念合并。

    只做**保守**的等价折叠，不做模糊匹配或语义推断：
    - 统一宽度（全角→半角）
    - 折叠空白
    - 小写化（英文大小写不应产生两个节点）
    - 去掉常见的装饰性后缀，如「（一）」「(上)」「的定义」

    刻意保留「的定义」这类语义后缀的处理仅在括号/序号层面，
    避免把「导数的定义」和「导数的几何意义」错误合并。
    """
    text = unicodedata.normalize("NFKC", value).strip().lower()
    text = " ".join(text.split())
    # 去掉结尾的序号/章节标记，如（一）(上)、【1】
    text = re.sub(r"[\s（(【\[][一二三四五六七八九十\d]+\s*[）)】\]]$", "", text)
    # 去掉结尾的「（上/下/续）」等卷次标记
    text = re.sub(r"[\s（(【\[](上|下|续|完|补)\s*[）)】\]]$", "", text)
    return text.strip(" 　:：-—·、,")
