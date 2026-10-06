# 本地运行与备份操作

## 启动

从仓库根目录执行 `./scripts/dev.ps1`。脚本会先迁移 SQLite，再启动 API、任务执行器和 Vite；服务只监听本机地址。手动运行时必须同时启动 `uv run python -m app.workers.runner`。

## 备份

阶段一检查点仍可用：`./scripts/backup.ps1`。阶段四完整包使用：

```powershell
./scripts/backup.ps1 -Package
```

包包含 SQLite 一致性快照、课程原文件、哈希清单和派生索引说明，不包含 `.env`、密钥和缓存凭据。可以用 `uv run python -m app.services.backup preview <包路径>` 检查包。

## 恢复

恢复只写入空目录，避免未经确认替换当前数据：

```powershell
./scripts/restore.ps1 -Package -Checkpoint <包路径> -Destination <空目录>
```

恢复前会校验路径、包版本、文件数量、哈希和 SQLite 完整性。恢复后再按 README 启动服务，并抽查课程、原文件、笔记版本、来源、知识树和会话。
