"""Bounded, explicit policy for optional external search."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from typing import Any


@dataclass(frozen=True)
class SearchPolicy:
    allow: bool = True
    max_results: int = 4
    daily_limit: int = 30
    timeout_seconds: float = 20.0
    cache_seconds: int = 600


_day = datetime.now(UTC).date()
_used = 0
_cache: dict[str, tuple[datetime, list[dict[str, Any]]]] = {}
_cache_lock = Lock()


def can_search(policy: SearchPolicy) -> tuple[bool, str]:
    global _day, _used
    today = datetime.now(UTC).date()
    if today != _day:
        _day, _used = today, 0
    if not policy.allow:
        return False, "disabled_by_request"
    if _used >= policy.daily_limit:
        return False, "daily_limit"
    return True, "allowed"


def record_search() -> None:
    global _used
    _used += 1


def search_cache_key(query: str) -> str:
    return " ".join(query.casefold().split())[:1000]


def cached_search(query: str, *, max_age_seconds: int = 600) -> list[dict[str, Any]] | None:
    key = search_cache_key(query)
    now = datetime.now(UTC)
    with _cache_lock:
        item = _cache.get(key)
        if item is None:
            return None
        created_at, results = item
        if (now - created_at).total_seconds() > max_age_seconds:
            _cache.pop(key, None)
            return None
        return [dict(result) for result in results]


def cache_search(query: str, results: list[dict[str, Any]], *, max_entries: int = 64) -> None:
    key = search_cache_key(query)
    with _cache_lock:
        _cache[key] = (datetime.now(UTC), [dict(result) for result in results])
        while len(_cache) > max_entries:
            _cache.pop(next(iter(_cache)))
