# 来源证据与覆盖

每个解析位置有稳定位置键、提取方法、置信度和告警。PPTX 使用 `slide:N`，PDF 使用 `pdf-page:N`，DOCX 使用 `docx-section:N`。旧 `page_number` 字段继续保留，供阶段一客户端兼容；新页面显示优先使用 `location_label`。

`SourceRef` 指向真实的页面块，`NoteSourceMapping` 记录笔记片段到来源的映射。旧的整篇笔记多对多关系仍保留，因此历史数据不会被迁移脚本编造段落级出处。重解析无法复用位置时应将来源标记为 `stale`/`review`，不能静默改指向新文本。

`GET /api/v1/materials/{material_id}/coverage` 根据当前有效来源事实即时聚合：被笔记来源引用的位置为 `cited`，其余为 `review`。知识节点存在、检索命中、解析成功或外部网页来源都不算课件覆盖。响应中的 `note_ids` 和 `note_titles` 用于从课程资料跳回笔记；外部来源单独展示。
