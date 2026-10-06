"""Bounded, explicit policy for optional external search."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class SearchPolicy:
    allow: bool = True
    max_results: int = 4
    daily_limit: int = 30
    timeout_seconds: float = 20.0


_day = datetime.now(UTC).date()
_used = 0


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
