from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.deepseek import DeepSeekClient, DeepSeekError
from app.ai.prompts import build_answer_messages
from app.api.v1.shared import ensure_course
from app.db.database import get_db
from app.db.models import (
    Material,
    WebSource,
)
from app.retrieval.service import build_context, retrieve
from app.schemas.api import (
    AssistantRequest,
    AssistantResponse,
    AssistantSource,
)

router = APIRouter()


@router.post("/courses/{course_id}/assistant", response_model=AssistantResponse)
def ask_assistant(
    course_id: str,
    payload: AssistantRequest,
    db: Session = Depends(get_db),
) -> AssistantResponse:
    course = ensure_course(db, course_id)
    selected_material = db.get(Material, payload.material_id) if payload.material_id else None
    if payload.material_id and selected_material is None:
        raise HTTPException(status_code=404, detail="所选资料不存在")
    if selected_material and selected_material.course_id != course_id:
        raise HTTPException(status_code=400, detail="所选资料不属于当前课程")
    if selected_material and selected_material.deleted_at is not None:
        raise HTTPException(status_code=404, detail="所选资料不存在")
    chunks = retrieve(
        db,
        course_id=course_id,
        question=payload.question,
        material_id=payload.material_id,
        page_number=payload.page_number,
    )
    web_status = "unavailable"
    web_results: list[dict] = []
    from app.web_search.tavily import WebSearchError
    from app.web_search.tavily import configured as web_search_configured
    from app.web_search.tavily import search as web_search
    if web_search_configured():
        try:
            scope = f" {selected_material.lecture_title}" if selected_material else ""
            web_results = [item for item in web_search(f"{course.name}{scope} {payload.question}", max_results=4) if item.get("score") is None or item["score"] >= 0.3]
            web_status = "completed" if web_results else "no_results"
            for item in web_results:
                if db.scalar(select(WebSource.id).where(WebSource.course_id == course_id, WebSource.url == item["url"])) is None:
                    db.add(WebSource(course_id=course_id, material_id=payload.material_id, search_query=payload.question[:1000], **item))
            db.commit()
        except WebSearchError:
            web_status = "failed"
    if not chunks and not web_results:
        return AssistantResponse(
            answer=("联网检索暂时失败，当前课程页面也没有找到相关依据。请稍后重试，或调整问题关键词。" if web_status == "failed" else "当前课程的已解析页面中没有找到与问题直接匹配的内容。可以尝试更换关键词，或先上传并解析相关课件。"),
            sources=[],
            web_search_status=web_status,
        )

    sources = [
        AssistantSource(
            source_type="course_material",
            material_id=chunk.material_id,
            lecture_title=chunk.lecture_title,
            page_number=chunk.page_number,
            snippet=chunk.text[:240] or "该页没有可展示的文本",
        )
        for chunk in chunks
    ]
    sources.extend(AssistantSource(
        source_type="web", title=item["title"], url=item["url"], site_name=item["site_name"],
        snippet=item["snippet"], retrieved_at=datetime.now(UTC), published_at=item.get("published_at"),
    ) for item in web_results)
    local_context = build_context(chunks)
    web_context = "\n\n".join(f"[网络来源 {index + 1} | {item['title']} | {item['url']} | 检索日期 {item.get('published_at') or '未提供'}]\n{item['snippet']}" for index, item in enumerate(web_results))
    context = "\n\n".join(part for part in ["【课程课件】\n" + local_context if local_context else "", "【联网补充】\n" + web_context if web_context else ""] if part)
    client = DeepSeekClient()
    if client.configured:
        try:
            response = client.complete_json(
                build_answer_messages(payload.question, context), max_tokens=2400
            )
            answer = str(response.get("answer_markdown") or "").strip()
            if answer:
                return AssistantResponse(answer=answer, sources=sources, mode="deepseek-rag", web_search_status=web_status)
        except DeepSeekError:
            pass

    local_excerpt = "\n\n".join(f"[课程资料：{chunk.lecture_title} | 第 {chunk.page_number} 页] {chunk.text[:240]}" for chunk in chunks)
    web_excerpt = "\n\n".join(f"[网络来源 {index + 1}：{item['title']} | {item['url']}] {item['snippet'][:240]}" for index, item in enumerate(web_results))
    answer = "当前没有可用的 AI 模型；以下是检索摘录，课程课件和网络来源已分开列出，不构成模型整理的回答。\n\n" + "\n\n".join(part for part in (local_excerpt, web_excerpt) if part)
    return AssistantResponse(answer=answer, sources=sources, mode="local-retrieval-fallback", web_search_status=web_status)
