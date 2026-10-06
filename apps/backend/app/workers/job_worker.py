"""常驻后台工作者：把解析任务从「请求进程」里剥离出来。

为什么需要它
------------
早期实现用 FastAPI 的 `BackgroundTasks` 跑 `process_material`。任务因此
**寄生在处理上传请求的那个进程里**，带来两个真实故障：

1. 后端一旦重启（改代码、崩溃、用户重开），正在跑的任务**永久丢失**，
   数据库里状态卡在 `processing`，界面表现就是「一直在解析」，永不结束。
2. 没有队列概念，多个上传并发时会互相抢 SQLite 写锁。

现在的做法
----------
一个常驻后台线程轮询 `processing_jobs` 表（表本身就是队列）：

- 上传接口只负责**写一条 pending 任务**，立刻返回；
- 工作线程 claim 一条 pending 任务（乐观置为 processing）后执行；
- 进程启动时把遗留的 `processing` 任务**重新放回 pending**（自愈），
  因为进程刚起，不可能是「正在被别的进程处理」——那些状态一定是上次
  崩溃/重启留下的孤儿。

之所以用「数据库表 + 轮询」而不是引入 Celery/RQ：本地单用户 Demo，
零外部依赖比功能丰富更重要。表已经是持久化的，天然具备断点续跑的基础。
"""

from __future__ import annotations

import logging
import threading

from sqlalchemy import select, update

from app.db.database import SessionLocal
from app.db.models import ProcessingJob
from app.workers.material_worker import process_material

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 1.0


class JobWorker:
    """单线程任务消费者。

    单线程是刻意的：SQLite 写并发能力有限，串行执行既简化了锁竞争，
    也让本地 Demo 的资源占用可预期。
    """

    def __init__(self, poll_interval: float = POLL_INTERVAL_SECONDS) -> None:
        self._poll_interval = poll_interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ---------- 生命周期 ----------

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._recover_stuck_jobs()
        self._thread = threading.Thread(target=self._run, name="notebook-worker", daemon=True)
        self._thread.start()
        logger.info("后台任务工作者已启动")

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
            self._thread = None

    # ---------- 自愈 ----------

    def _recover_stuck_jobs(self) -> int:
        """把上次进程遗留的 processing 任务放回 pending。

        进程刚启动，不可能正在处理任何任务；此刻仍标记为 processing 的
        记录一定是上次崩溃/重启打断的。重跑比让它永远卡住更安全——
        解析与提取都是幂等的（`material.pages.clear()` + 归一化名称去重）。
        """
        db = SessionLocal()
        try:
            stuck = db.scalars(
                select(ProcessingJob).where(ProcessingJob.status == "processing")
            ).all()
            for job in stuck:
                job.status = "pending"
                job.progress = 0
                job.error_message = None
            db.commit()
            if stuck:
                logger.warning("自愈：%d 个任务从 processing 重置为 pending", len(stuck))
            return len(stuck)
        except Exception:  # pragma: no cover - 启动期容错
            db.rollback()
            logger.exception("自愈遗留任务失败")
            return 0
        finally:
            db.close()

    # ---------- 主循环 ----------

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                claimed = self._claim_next_job()
            except Exception:  # pragma: no cover - 轮询容错
                logger.exception("claim 任务失败")
                claimed = None

            if claimed is None:
                self._stop.wait(self._poll_interval)
                continue

            try:
                process_material(claimed)
            except Exception:  # pragma: no cover - process_material 内部已捕获
                logger.exception("任务 %s 执行异常", claimed)

    def _claim_next_job(self) -> str | None:
        """取出一条 pending 任务并标记为 processing，返回其 id。

        用「先读后条件更新」的方式 claim：UPDATE 带 `status='pending'` 条件，
        rowcount 为 0 说明被别的消费者抢走了，本轮跳过。
        """
        db = SessionLocal()
        try:
            job = db.scalar(
                select(ProcessingJob)
                .where(ProcessingJob.status == "pending")
                .order_by(ProcessingJob.created_at)
                .limit(1)
            )
            if job is None:
                return None

            result = db.execute(
                update(ProcessingJob)
                .where(ProcessingJob.id == job.id, ProcessingJob.status == "pending")
                .values(status="processing", progress=1)
            )
            db.commit()
            if result.rowcount == 0:
                return None
            return job.id
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


worker = JobWorker()
