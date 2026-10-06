"""打印当前代码里注册的路由，供自检脚本与人工排查使用。

用途：确认「正在运行的后端」是否落后于「磁盘上的代码」。
典型症状——新写了接口、浏览器却报 404，实际是旧 uvicorn 进程还占着端口。

用法：
    uv run python scripts/list_routes.py            # 在 apps/backend 下
    uv run python ../../scripts/list_routes.py      # 从其他目录
输出 JSON：{"/path": ["GET", "POST"], ...}，便于外部脚本对比。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# 允许从仓库任意位置运行：把 apps/backend 加入 import 路径
_BACKEND = Path(__file__).resolve().parents[1] / "apps" / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.main import app


def main() -> int:
    paths = app.openapi().get("paths", {})
    out = {
        path: sorted(method.upper() for method in ops)
        for path, ops in sorted(paths.items())
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
