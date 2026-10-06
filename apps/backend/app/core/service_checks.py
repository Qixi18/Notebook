"""Explicit, bounded checks for optional external providers."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.ai.deepseek import DeepSeekClient
from app.core.config import settings
from app.retrieval.embedding import EmbeddingClient
from app.services.provider_audit import begin_call, finish_call, provider_status_from_error
from app.web_search.tavily import search

LAST_RESULTS: dict[str, dict] = {}
MIN_INTERVAL = timedelta(minutes=1)


def _configured(provider: str) -> bool:
    if provider == "deepseek":
        return DeepSeekClient().configured
    if provider == "embedding":
        return EmbeddingClient().configured
    if provider == "tavily":
        return bool(settings.tavily_api_key)
    raise ValueError("Unknown provider")


def provider_status(provider: str) -> dict:
    configured = _configured(provider)
    result = LAST_RESULTS.get(provider) if configured else None
    return {
        "provider": provider,
        "configured": configured,
        "status": result["status"] if result else ("configured_untested" if configured else "unconfigured"),
        "checked_at": result["checked_at"] if result else None,
    }


def _error_status(exc: Exception) -> str:
    cause = exc
    while cause.__cause__ is not None:
        cause = cause.__cause__
    if isinstance(cause, httpx.HTTPStatusError):
        code = cause.response.status_code
        if code in (401, 403):
            return "authentication_failed"
        if code == 429:
            return "rate_limited"
    if isinstance(cause, httpx.TimeoutException):
        return "timeout"
    return "unavailable"


def check_provider(provider: str, db: Session | None = None) -> dict:
    if not _configured(provider):
        return provider_status(provider)
    now = datetime.now(UTC)
    prior = LAST_RESULTS.get(provider)
    if prior and now - prior["checked_at"] < MIN_INTERVAL:
        return provider_status(provider)
    audit = None
    started = None
    if db is not None:
        audit, started = begin_call(
            db,
            provider=provider,
            operation="connectivity_check",
            model=(settings.deepseek_model if provider == "deepseek" else settings.embedding_model if provider == "embedding" else "tavily-basic"),
            request_units=1,
        )
    try:
        if provider == "deepseek":
            DeepSeekClient().complete([{"role": "user", "content": "请回复 OK"}], max_tokens=8)
        elif provider == "embedding":
            EmbeddingClient().embed(["连接测试"])
        else:
            search("learning", max_results=1)
        status = "connected"
    except Exception as exc:
        status = _error_status(exc)
        if audit is not None and started is not None:
            finish_call(
                db,
                audit,
                started,
                status=provider_status_from_error(exc),
                error_type=type(exc).__name__,
            )
    else:
        if audit is not None and started is not None:
            finish_call(db, audit, started, status="success", response_units=1)
    LAST_RESULTS[provider] = {"status": status, "checked_at": now}
    return provider_status(provider)
