from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import settings


class WebSearchError(RuntimeError):
    pass


def configured() -> bool:
    return bool(settings.tavily_api_key)


def search(query: str, *, max_results: int = 5) -> list[dict[str, Any]]:
    if not configured():
        raise WebSearchError("TAVILY_API_KEY 未配置")
    try:
        response = httpx.post(
            "https://api.tavily.com/search",
            headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
            json={
                "query": query,
                "search_depth": "basic",
                "topic": "general",
                "max_results": max_results,
                "include_answer": False,
                "include_raw_content": False,
                "include_published_date": True,
                "safe_search": True,
            },
            timeout=settings.web_search_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise WebSearchError(f"联网搜索暂不可用：{type(exc).__name__}") from exc

    results: list[dict[str, Any]] = []
    for item in payload.get("results", []):
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            continue
        results.append({
            "title": str(item.get("title") or parsed.netloc)[:500],
            "url": url,
            "site_name": parsed.netloc[:255],
            "snippet": str(item.get("content") or "")[:3000],
            "score": item.get("score") if isinstance(item.get("score"), (int, float)) else None,
            "published_at": str(item.get("published_date") or "")[:100] or None,
        })
    return results
