"""Persist safe provider-call telemetry without request bodies or secrets."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from time import perf_counter
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ProviderCall


def begin_call(
    db: Session,
    *,
    provider: str,
    operation: str,
    course_id: str | None = None,
    material_id: str | None = None,
    model: str | None = None,
    request_units: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[ProviderCall, float]:
    """Create a pending record and return its monotonic start time."""
    record = ProviderCall(
        provider=provider,
        operation=operation,
        status="started",
        course_id=course_id,
        material_id=material_id,
        model=model,
        request_units=request_units,
        metadata_json=json.dumps(metadata or {}, ensure_ascii=False, sort_keys=True),
    )
    db.add(record)
    db.flush()
    return record, perf_counter()


def finish_call(
    db: Session,
    record: ProviderCall,
    started: float,
    *,
    status: str,
    request_units: int | None = None,
    response_units: int | None = None,
    estimated_cost_usd: float | None = None,
    error_type: str | None = None,
) -> None:
    record.status = status
    if request_units is not None:
        record.request_units = request_units
    record.response_units = response_units
    record.estimated_cost_usd = estimated_cost_usd
    record.error_type = error_type
    record.duration_ms = round((perf_counter() - started) * 1000, 3)
    record.completed_at = datetime.now(UTC)
    db.flush()


def provider_status_from_error(exc: BaseException) -> str:
    """Map an exception to a stable, non-sensitive audit status."""
    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        return "rate_limited"
    if status_code in (401, 403):
        return "authentication_failed"
    if isinstance(status_code, int) and status_code >= 500:
        return "unavailable"
    if isinstance(exc, TimeoutError) or exc.__class__.__name__.endswith("TimeoutException"):
        return "timeout"
    return "failed"


def estimate_token_cost(
    usage: dict[str, int] | None,
    *,
    input_rate_per_million: float,
    output_rate_per_million: float,
) -> float | None:
    if not usage or not (input_rate_per_million or output_rate_per_million):
        return None
    return round(
        usage.get("prompt_tokens", 0) * input_rate_per_million / 1_000_000
        + usage.get("completion_tokens", 0) * output_rate_per_million / 1_000_000,
        8,
    )
