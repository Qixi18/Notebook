# NoteBuddy 初版架构

## 当前目标

初版先实现本地单用户 Web Demo：

```text
课程 → 讲次资料 → 逐页解析 → PageBlock 来源引用 → 知识点/笔记 → 检索问答
```

基础知识点提取、可编辑笔记、版本保护和可选外部模型调用已经接入；语义 Embedding 通过可配置的兼容接口启用。

## 运行边界

- `apps/web`：React + TypeScript + Vite，负责三栏笔记工作区。
- `apps/backend`：FastAPI，负责课程、文件、解析任务、知识图谱、笔记版本、模型调用和检索 API。
- `data`：本机数据目录，不提交到 Git。
- SQLite：业务数据真实来源。
- 向量索引：`retrieval_chunks` 中作为可重建的检索派生数据，不承载用户笔记真相。
- 外部模型：`app/ai/deepseek.py` 只读取环境变量中的 API 配置；模型失败时回退到本地规则，不暴露密钥。
- Markdown 数学排版：后端提示词约束 LaTeX，前端使用 `remark-math` + `rehype-katex` 渲染。

## 阶段一运行与数据边界

API 只登记待处理资料任务；`app.workers.runner` 是同仓库的本地单实例任务执行器，不提供第二套 HTTP API。`scripts/dev.ps1` 先迁移数据库，再启动执行器、API 与 Vite。执行器用 OS 文件锁避免并行处理，进程重启后把上次中断的处理中任务明确标为可重试失败。上传时使用临时文件、PPTX 容器检查、原子落盘和哈希；相同课程的重复文件默认提示，允许显式作为新讲次导入。

SQLite 是业务真相，Alembic 负责版本迁移；迁移与逻辑删除前使用可校验检查点。见 `docs/migrations.md`。外部服务状态区分“已配置”和“连接成功”，连接测试需要用户主动触发。

## 任务状态

资料解析任务必须经过：

```text
pending → processing → completed
                    ↘ failed
```

任务状态持久化到数据库，前端通过 `GET /api/v1/jobs/{job_id}` 查询。后续接入 SSE 时保持同一任务模型。

## 后续扩展

## 当前数据关系

```text
Course
 ├─ Material ─ MaterialPage ─ PageBlock ─ SourceRef
 │                                  └─ RetrievalChunk
 ├─ KnowledgeNode ─ KnowledgeEdge ─ KnowledgeNode
 │       └─ Note ─ NoteRevision
 └─（知识点和笔记通过多对多关系引用 SourceRef）
```

`Note.user_locked=true` 后，后续资料解析只会补充来源和知识节点摘要，不会覆盖用户笔记正文。`revision_number` 用于乐观并发保护，前端保存时必须携带当前版本号。

## 已实现 API

| 能力 | 接口 |
|---|---|
| 课程知识图谱 | `GET /api/v1/courses/{course_id}/knowledge-graph` |
| 课程笔记 | `GET /api/v1/courses/{course_id}/notes` |
| 笔记编辑 | `PATCH /api/v1/notes/{note_id}` |
| 笔记版本 | `GET /api/v1/notes/{note_id}/revisions` |
| 笔记来源 | `GET /api/v1/notes/{note_id}/sources` |
| 课程范围 RAG | `POST /api/v1/courses/{course_id}/assistant` |

## 后续工作

1. 增加 PDF/DOCX 解析和更细粒度的来源位置（段落、形状、坐标）。
2. 接入真实 Embedding 服务并增加离线索引重建、向量库迁移和召回评测。
3. 将知识点关系从“同批次可见节点”提升为跨讲增量去重和人工调整。
4. 增加覆盖总览、来源点击回跳和笔记历史恢复 UI。
5. Electron 包装继续接入后端进程生命周期和生产环境静态资源。
