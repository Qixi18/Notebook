# 阶段一 API 契约

现有 `/api/v1` 地址保持不变。路由按 `courses.py`、`materials.py`、`jobs.py`、`knowledge.py`、`notes.py`、`assistant.py`、`config.py` 拆分，`routes.py` 负责汇总。输入和输出模型在 `app/schemas/` 按域声明，`app/schemas/api.py` 保留兼容导出。

| 能力 | 接口 | 阶段一行为 |
|---|---|---|
| 上传 | `POST /courses/{course_id}/materials` | 只保存文件并创建 `pending` 任务，返回资料和任务；执行器异步处理。支持可选 `Idempotency-Key` 请求头和 `allow_duplicate` 表单字段 |
| 查询任务 | `GET /jobs/{job_id}`、`GET /materials/{material_id}/latest-job` | 返回状态、阶段、进度、错误码、错误消息、尝试次数 |
| 重试 | `POST /materials/{material_id}/retry` | 仅失败任务可重试；新建待处理任务，原文件保留 |
| 配置状态 | `GET /config/status` | 区分未配置、已配置未验证及本进程最近一次连接结果，不返回密钥 |
| 主动测试 | `POST /config/check/{deepseek\|embedding\|tavily}` | 用户主动触发单次最小调用；每服务至少间隔 1 分钟；可能产生费用 |
| 课程移除 | `GET /courses/{course_id}/deletion-preview` → `DELETE /courses/{course_id}` → `POST /courses/{course_id}/restore` | 预览影响、删除前检查点、逻辑删除及恢复；有活动任务时拒绝 |
| 资料移除 | `GET /materials/{material_id}/deletion-preview` → `DELETE /materials/{material_id}` → `POST /materials/{material_id}/restore` | 同上；原文件、知识节点、用户笔记仍保留 |
| 恢复列表 | `GET /courses/deleted`、`GET /courses/{course_id}/deleted-materials` | 供本地 UI 显示可恢复对象 |

资料、笔记、任务等独立 ID 接口会校验所属课程仍有效；跨课程资料筛选不能用于另一课程答疑。答疑未传 `material_id` 时表示整门课程。当前对话仍为单轮，会话持久化留待阶段三。

`GET /web-search/status` 继续兼容旧前端字段，但 Key 存在时状态是 `configured_untested`，不代表认证或搜索已成功。调用模型、联网和 Embedding 的实际结果需单独记录，不以配置状态替代联调验收。
