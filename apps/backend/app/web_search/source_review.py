"""Classify web results without treating score or domain as proof."""

from __future__ import annotations

from collections import defaultdict
from urllib.parse import urlparse


def classify_source(item: dict) -> str:
    host = urlparse(str(item.get("url") or "")).netloc.casefold()
    if any(host.endswith(domain) for domain in (".edu", ".ac.uk", ".gov", ".gov.cn")):
        return "institutional"
    if any(host.endswith(domain) for domain in (".org", ".ac.cn")):
        return "organization"
    return "web"


def review_results(results: list[dict]) -> dict:
    groups: dict[str, list[dict]] = defaultdict(list)
    reviewed = []
    for item in results:
        row = dict(item)
        row["source_type"] = classify_source(row)
        row["review_warning"] = "搜索结果是待核对资料；域名和分数不等于事实证明"
        reviewed.append(row)
        title_key = " ".join(str(row.get("title") or "").casefold().split())
        if title_key:
            groups[title_key].append(row)
    return {
        "results": reviewed,
        "conflict_groups": [items for items in groups.values() if len(items) > 1],
    }
