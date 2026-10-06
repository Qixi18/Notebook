from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


# SQLite 同一时刻只允许一个写者。默认的 busy 超时极短，只要后台任务与
# 接口请求并发写就会立刻抛 `database is locked`（本项目已多次遇到）。
# 给足等待时间，让并发的写操作排队而不是直接失败。
_SQLITE_BUSY_TIMEOUT_SECONDS = 30

engine = create_engine(
    settings.database_url,
    connect_args={
        "check_same_thread": False,
        "timeout": _SQLITE_BUSY_TIMEOUT_SECONDS,
    },
)


@event.listens_for(engine, "connect")
def configure_sqlite(dbapi_connection: object, _: object) -> None:
    """连接建立时统一设置 SQLite 行为。"""
    if not settings.database_url.startswith("sqlite"):
        return
    cursor = dbapi_connection.cursor()
    try:
        # 删除语义由外键约束保证（Course 上的 ORM cascade 是第二道保险）
        cursor.execute("PRAGMA foreign_keys=ON")
        # 写锁等待时间，与 connect_args 的 timeout 保持一致
        cursor.execute(f"PRAGMA busy_timeout={_SQLITE_BUSY_TIMEOUT_SECONDS * 1000}")
        # WAL 模式让「读」与「写」可以并发，后台任务写库时接口仍能读，
        # 避免解析过程中整个应用卡住。桌面单用户场景收益明显。
        cursor.execute("PRAGMA journal_mode=WAL")
        # 牺牲极端断电下的最后几毫秒持久性换取吞吐；NORMAL 与 WAL 搭配是推荐组合
        cursor.execute("PRAGMA synchronous=NORMAL")
    finally:
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
