# NoteBuddy 初版架构

## 当前目标

初版先实现本地单用户 Web Demo：

```text
课程 → 讲次资料 → 逐页解析 → 页面来源 → 本地检索问答
```

知识点笔记、知识树增量整理和外部模型调用将在这条数据链路稳定后继续接入。

## 运行边界

- `apps/web`：React + TypeScript + Vite，负责三栏笔记工作区。
- `apps/backend`：FastAPI，负责课程、文件、解析任务和本地检索 API。
- `data`：本机数据目录，不提交到 Git。
- SQLite：业务数据真实来源。
- 向量索引：后续作为可重建的检索派生数据，不承载用户笔记真相。

## 任务状态

资料解析任务必须经过：

```text
pending → processing → completed
                    ↘ failed
```

任务状态持久化到数据库，前端通过 `GET /api/v1/jobs/{job_id}` 查询。后续接入 SSE 时保持同一任务模型。

## 后续扩展

1. 将 `PageBlock` 连接到 `KnowledgeNode` 和 `SourceRef`。
2. 增加可编辑笔记及版本保护。
3. 增加 Embedding 和课程范围内 RAG。
4. 增加知识树和逐页覆盖总览。
5. 最后再增加 Electron 桌面包装。

