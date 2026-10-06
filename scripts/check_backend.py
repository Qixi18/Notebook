#!/usr/bin/env python
"""后端自检：确认「正在运行的服务」没有落后于「磁盘上的代码」。

背景：uvicorn --reload 有时不会干净重启（尤其端口被上一个进程占着时），
结果新写的接口在代码里、浏览器却仍在和旧进程说话，看起来就像「功能没实现」。
本脚本对比两边的路由表，把差异直接指出来。

用法（在仓库根目录）：
    python scripts/check_backend.py
退出码 0 = 一致；1 = 服务落后或未启动。
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
BACKEND = ROOT / "apps" / "backend"


def resolve_port() -> int:
    if not ENV_FILE.exists():
        return 8000
    text = ENV_FILE.read_text(encoding="utf-8")
    match = re.search(r"^\s*NOTEBOOK_PORT\s*=\s*(\d+)", text, re.MULTILINE)
    return int(match.group(1)) if match else 8000


# 前端 Vite 代理只会转发到 NOTEBOOK_PORT 指定的端口。若后端跑在别的端口上，
# 浏览器每个请求都会 502/500，看起来像「项目崩了」，但前后端其实都活着。
CANDIDATE_PORTS = (8000, 8001, 8020, 8021, 8080)


def fetch_json(url: str, timeout: float = 5.0) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return json.load(response)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None


def route_map(paths: dict) -> dict[str, list[str]]:
    return {path: sorted(m.upper() for m in ops) for path, ops in paths.items()}


def code_routes() -> dict[str, list[str]] | None:
    """在当前进程内导入 app 读取路由（避免调用 uv run）。"""
    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))
    try:
        from app.main import app
    except Exception as exc:  # pragma: no cover - 环境问题
        print(f"[!] 无法导入应用，跳过代码侧对比：{type(exc).__name__}: {exc}")
        return None
    return route_map(app.openapi().get("paths", {}))


def main() -> int:
    port_configured = resolve_port()
    port = port_configured
    base = f"http://127.0.0.1:{port}"

    print()
    print(f"NoteBuddy 后端自检  ·  端口 {port}")
    print("-" * 56)

    health = fetch_json(f"{base}/api/v1/health", timeout=3)
    if health is None:
        print(f"[X] {base} 无响应 —— 后端没有在运行。")
        # 关键补充：后端可能活着，只是跑在了别的端口上。
        # 这会让前端代理全部 502，表现为「项目崩了」，但服务其实没挂。
        elsewhere = [
            port
            for port in CANDIDATE_PORTS
            if port != port_configured and fetch_json(f"http://127.0.0.1:{port}/api/v1/health", 2)
        ]
        if elsewhere:
            print()
            print("[!] 但在这些端口上探测到运行中的后端：")
            for alt in elsewhere:
                print(f"    http://127.0.0.1:{alt}  (≠ 配置的 {port_configured})")
            print()
            print("=> 这就是「请求失败 / 项目崩了」的典型原因：端口错位。")
            print("   前端 Vite 代理只转发到 NOTEBOOK_PORT 指定的端口，")
            print("   后端却跑在别的端口上，于是浏览器每个请求都 502。")
            print()
            print("   修复（二选一）：")
            print(f"     A. 把根目录 .env 的 NOTEBOOK_PORT 改成 {elsewhere[0]}，然后重启前端")
            print(f"     B. 停掉 {elsewhere[0]} 上的后端，改在 {port_configured} 上重启")
        else:
            print("    启动：cd apps/backend && uv run uvicorn app.main:app --reload --port " + str(port))
        return 1
    print(f"[OK] 服务在线：{health.get('service')}")

    schema = fetch_json(f"{base}/openapi.json", timeout=6)
    if schema is None:
        print("[X] 无法读取运行中服务的 OpenAPI 文档。")
        return 1
    live = route_map(schema.get("paths", {}))

    code = code_routes()
    if code is None:
        print("[!] 无法读取代码侧路由，只列出服务已注册的接口：")
        for path in sorted(live):
            print(f"  {','.join(live[path]):<12} {path}")
        return 0

    missing = []
    for path, methods in code.items():
        live_methods = live.get(path, [])
        gap = [m for m in methods if m not in live_methods]
        if gap:
            missing.append((path, gap))

    print()
    if not missing:
        print(f"[OK] 运行中的服务与当前代码一致（共 {len(code)} 个接口）。")
        return 0

    print("[X] 服务落后于代码！以下接口在代码里存在，但服务未注册：")
    for path, gap in sorted(missing):
        print(f"  {','.join(gap):<12} {path}")
    print()
    print("=> 这正是「功能没实现」的典型原因：旧进程仍占用端口。")
    print(f"   修复：停掉占用 {port} 的进程后重启后端。")
    print(f"   查进程：Get-NetTCPConnection -LocalPort {port} -State Listen | Select-Object OwningProcess")
    return 1


if __name__ == "__main__":
    sys.exit(main())
