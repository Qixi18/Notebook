# 课程笔记本执行记录

分支：`feat/course-notebook`；基线：`97eb151`；用户已授权检查通过后合并 main，不推送。

| 任务 | 状态 | 证据 / 待办 |
| --- | --- | --- |
| 1 基线与迁移 | 已实现并验证 | Web 构建通过；后端初始 14 failed / 89 passed / 1 skipped。旧测试与现有软删除、建议保护、任务唯一性、迁移 head、解析告警发生偏差；另有真实的笔记重复插入、关系名称匹配、课程更新字段校验问题。 |
| 2 按讲生成 | 已实现并验证 | 同概念不同正文、重试稳定身份、相似提案不阻断阅读 |
| 3 API 与顺序 | 已实现并验证 | 版本冲突、课程隔离、历史分组、来源归属 |
| 4 阅读器 | 已实现并验证 | 书架、章节/整本、准确小节、编辑历史 |
| 5 入口联动 | 已实现并验证 | 各讲叶子、覆盖跳转、查询参数草稿保护 |
| 6 验收与合并 | 进行中 | 全套检查、浏览器、独立审查、合并 |

原始本地 Word / 需求文件不随手暂存。实际课程、真实 AI、专项知识树视觉不在本轮验收结论中。

裁定：数据模型、生成、API 相互依赖，任务 1–3 合并为后端提交；任务 4–5 为前端提交。仍按用例观察 RED→GREEN。旧测试更新遵循已有软删除和建议机制，未恢复自动覆盖。浏览器备用 Playwright CLI，内置浏览器沙箱启动失败。

Task 1–3: complete (commit 276062b); Task 4–5: complete (commit 703f52d). Backend full suite: 114 passed, 1 skipped (real deck fixture absent), 1 upstream deprecation warning; Ruff passed. Web: 4 tests passed, production build passed. Final review and merge pending.
