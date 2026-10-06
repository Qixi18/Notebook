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

## 任务状态

资料解析任务必须经过：

```text
pending → processing → completed
                    ↘ failed
```

任务状态持久化到数据库，前端通过 `GET /api/v1/jobs/{job_id}` 查询。后续接入 SSE 时保持同一任务模型。

## 知识点关系为什么必须两遍处理

`app/knowledge/extractor.py::extract_material_knowledge` 分两遍执行，这不是风格选择，而是**正确性要求**。

关系生成本质上需要「全局视图」：第 1 页提到的知识点，可能到第 40 页才被建立。早期实现是边建节点边连边：

```python
for page in pages:
    node = create_node(...)          # 建当前页的节点
    ensure_relations(db, node, ...)  # 立刻连边
```

而 `ensure_relations` 对找不到的目标节点是 `continue`（跳过，不凭空建节点）。于是：

1. 处理第 1 页时，第 40 页的知识点**还不存在** → 关系被丢弃
2. 处理第 40 页时，第 1 页早已处理完，**不会回头补边**

两边都落空，`knowledge_edges` 恒为 0——「知识树」于是只剩一堆孤立节点。

修复方案：

```python
# 第一遍：建立全部节点与笔记，把待连的关系收集起来
for page in pages:
    node = find_or_create_node(...)
    pending_relations.append((node, draft.get("relations")))
db.flush()                            # 确保本次新建的节点可被查询

# 第二遍：所有节点就位后统一连边
for node, raw_relations in pending_relations:
    ensure_relations(db, course_id, node, raw_relations)
```

配套加入**名称归一化**（`normalize_name`）：模型对同一概念可能给出「矩阵」「矩阵（一）」「矩阵(上)」等不同写法，精确字符串匹配会让它们变成两个孤立节点、关系也连不上。归一化只做保守折叠——统一宽度、折叠空白、小写化、去掉序号/卷次后缀——**刻意不做模糊匹配**，避免把「导数的定义」和「导数的几何意义」错误合并。测试中用参数化用例同时锁住「该合并的」与「不该合并的」两侧。

回归测试见 `tests/test_knowledge_relations.py`，其中 `test_cross_page_relation_resolves_after_all_nodes_exist` 精确复现上述 bug 场景。

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

`Course` 对 `Material`、`KnowledgeNode`、`Note`、`KnowledgeEdge`、`RetrievalChunk` 均声明 `cascade="all, delete-orphan"`，删除课程即可整链清理，不依赖 SQLite 外键开关。

`Note.user_locked=true` 后，后续资料解析只会补充来源和知识节点摘要，不会覆盖用户笔记正文。`revision_number` 用于乐观并发保护，前端保存时必须携带当前版本号。

## 已实现 API

| 能力 | 接口 |
|---|---|
| 创建课程 | `POST /api/v1/courses` |
| 课程列表 | `GET /api/v1/courses` |
| 课程重命名 | `PATCH /api/v1/courses/{course_id}` |
| 课程删除（级联） | `DELETE /api/v1/courses/{course_id}` |
| 课程知识图谱 | `GET /api/v1/courses/{course_id}/knowledge-graph` |
| 课程笔记 | `GET /api/v1/courses/{course_id}/notes` |
| 笔记编辑 | `PATCH /api/v1/notes/{note_id}` |
| 笔记版本 | `GET /api/v1/notes/{note_id}/revisions` |
| 笔记来源 | `GET /api/v1/notes/{note_id}/sources` |
| 课程范围 RAG | `POST /api/v1/courses/{course_id}/assistant` |
| 配置状态（脱敏） | `GET /api/v1/settings` |
| 配置写入（白名单） | `PATCH /api/v1/settings` |

## 设置面板安全模型

`apps/web` 左下角齿轮打开设置抽屉，数据来自 `GET /api/v1/settings`（只返回布尔与长度提示，**永不回传密钥明文**）。写入走 `PATCH /api/v1/settings`，实现在 `app/core/settings_store.py`，约束如下：

1. **白名单**：仅 `DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`、`DEEPSEEK_TIMEOUT_SECONDS`、`EMBEDDING_BASE_URL`、`EMBEDDING_MODEL`、`NOTEBOOK_MAX_UPLOAD_MB` 可直接写入；`NOTEBOOK_DATA_DIR`、`allowed_extensions` 等结构项永不可改。非白名单键在 Pydantic 层就以 `extra="forbid"` 拒绝。
2. **密钥双闸门**：`DEEPSEEK_API_KEY` / `EMBEDDING_API_KEY` 默认禁止写入，必须同时满足 `NOTEBOOK_ALLOW_SECRET_WRITE=true` 且请求头 `X-Notebook-Settings-Token` 与 `NOTEBOOK_SETTINGS_TOKEN` 匹配（`secrets.compare_digest` 常量时间比较）。未配置 token 时一律拒绝。
3. **写入前置校验**：写入新的 DeepSeek Key 前，先调用服务端 `/models` 探活。401/403 直接以 **422 拒绝写入**，**绝不覆盖仍然可用的旧密钥**；网络不可达时降级为 warning 并放行（可设 `NOTEBOOK_SKIP_KEY_VERIFY=true` 完全跳过）。
4. **注入防护**：拒绝含换行符的值（防止向 `.env` 注入额外键）、拒绝 `VITE_` 前缀（防止密钥被前端打包）、模型名仅允许字母数字连字符、URL 必须 `http(s)://`、数值有区间约束。
5. **可回滚且不破坏原文件**：写盘采用"原地改写托管键 + 保留全部注释与未托管键"的策略，而不是整体重写；写入前备份 `.env` 到 `data/backups/env-<时间戳>.bak`，仅保留最近 20 份（备份含明文，避免无限堆积），再用临时文件 `os.replace` 原子替换。
6. **密钥不可反向读出**：状态接口只返回 `**** · 共 N 位`，不保留任何真实前缀（早期版本保留前 4 位，对已知 `sk-` 前缀的厂商等于泄露熵，已修正）。

### 密钥不进版本库

`.env` 与 `data/` 均在 `.gitignore` 中，且仓库配置了 `core.hooksPath=.githooks`。`scripts/pre-commit` 提供四道拦截：① 暂存区出现 `.env` 实体文件 → 拒绝（`.env.example` 例外）；② 暂存 `data/` 下的数据库/课件/备份 → 拒绝；③ 新增行匹配 `sk-xxx`、`ghp_`、`AKIA`、`BEGIN PRIVATE KEY` 等密钥特征 → 拒绝（示例占位值白名单放行）；④ `.env` 脱离 ignore 状态 → 拒绝。确需绕过时用 `git commit --no-verify`。

安全测试见 `apps/backend/tests/test_settings_security.py`。

## 课程重命名与级联删除

课程卡片右键可打开操作菜单（重命名 / 删除课程），实现见 `apps/web/src/CourseContextMenu.tsx`。

- **重命名**：`PATCH /api/v1/courses/{course_id}` 只接受 `name` 一个字段（`extra="forbid"`），服务端去首尾空白并在空名时返回 400。课程下的资料、知识点、笔记均保留。
- **删除**：`DELETE /api/v1/courses/{course_id}` 会连带清除 `Material → MaterialPage → PageBlock → SourceRef / RetrievalChunk`、`KnowledgeNode → KnowledgeEdge → Note → NoteRevision` 以及两张多对多关联表。接口返回各表删除计数，前端据此展示提示条。磁盘上的原始课件文件在**数据库提交成功之后**才删除，避免出现"文件没了但记录还在"。
- **二次确认**：删除对话框要求用户完整输入课程名才解锁确认按钮，降低误删整个学期积累的风险。

### 级联不能只依赖 SQLite 外键 pragma

除 `materials` 外，`knowledge_nodes`、`notes`、`knowledge_edges`、`retrieval_chunks` 早期只有 `course_id` 外键，没有任何 ORM relationship。这意味着删除课程时，这些表**完全依赖 `PRAGMA foreign_keys=ON`** 这一引擎级开关。

`app/db/database.py` 确实注册了该 pragma 监听器，所以运行时是安全的；但一旦有人用别的 `create_engine`（测试夹具、迁移脚本、将来的异步驱动，或迁移到 PostgreSQL 时忘记等价设置），删除就会静默留下孤儿知识点和笔记——**不报错，但数据已经脏了**。

修正：在 `Course` 上为这四类关联补全 `relationship(cascade="all, delete-orphan")` 并互相 `back_populates`，让删除语义由 ORM 表达，而不是靠引擎配置"碰巧成立"。回归测试见 `apps/backend/tests/test_course_lifecycle.py::test_delete_course_removes_every_related_row`，该用例的引擎**刻意不开启外键**，用来锁住这条约束。

## 后续工作

1. 增加 PDF/DOCX 解析和更细粒度的来源位置（段落、形状、坐标）。
2. 接入真实 Embedding 服务并增加离线索引重建、向量库迁移和召回评测。
3. 关系生成目前依赖模型显式给出的 `target_name`；可加入「同批次语义相似度」兜底，让模型未显式声明关系时也能发现潜在关联。
4. 增加覆盖总览、来源点击回跳和笔记历史恢复 UI。
5. Electron 包装继续接入后端进程生命周期和生产环境静态资源。
6. 解析任务当前由 `BackgroundTasks` 在请求进程内执行，进程重启会丢失；后续应换成真正的任务队列（含重试与断点续传）。
