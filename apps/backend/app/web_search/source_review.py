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
    conflict_groups = []
    conflict_index = 0
    for items in groups.values():
        unique_urls = {str(item.get("url") or "") for item in items}
        if len(items) < 2 or len(unique_urls) < 2:
            continue
        conflict_index += 1
        group_id = f"title-conflict-{conflict_index}"
        for item in items:
            item["conflict_group_id"] = group_id
            item["review_warning"] += "；同标题存在多个来源，需人工核对是否矛盾"
        conflict_groups.append(items)
    return {"results": reviewed, "conflict_groups": conflict_groups}
