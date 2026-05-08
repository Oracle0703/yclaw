# MediaCrawler External Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a user-provided MediaCrawler checkout as an external executor for seven social platforms.

**Architecture:** YClaw stores executor configuration, builds MediaCrawler CLI commands, runs the external Python process, records logs, and imports JSON/JSONL outputs into the existing comment result pipeline. MediaCrawler source code is not copied into YClaw.

**Tech Stack:** Electron main process, TypeScript, Node `child_process`, existing ConfigService, BatchService, ResultService, ExecutionLogService, Vitest.

---

## File Structure

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `src/shared/types/comment.ts` | Modify | 增加 MediaCrawler 配置、平台、运行类型 |
| `src/shared/types/index.ts` | Modify | 导出新增类型 |
| `src/shared/constants/channels.ts` | Modify | 增加 `comment:mediacrawler:*` IPC |
| `src/main/services/comment/MediaCrawlerCommandBuilder.ts` | Create | 生成 CLI 命令 |
| `src/main/services/comment/MediaCrawlerResultImporter.ts` | Create | 导入输出文件 |
| `src/main/services/comment/MediaCrawlerExternalExecutor.ts` | Create | 启动外部进程、写日志、导入结果 |
| `src/main/ipc/comment-handlers.ts` | Modify | 注册配置/测试/启动 IPC |
| `src/main/app.ts` | Modify | 注入外部执行器 |
| `tests/unit/services/comment/MediaCrawlerCommandBuilder.test.ts` | Create | 命令映射测试 |
| `tests/unit/services/comment/MediaCrawlerResultImporter.test.ts` | Create | 导入测试 |
| `tests/unit/services/comment/MediaCrawlerExternalExecutor.test.ts` | Create | 执行器测试 |

## Task 1: Shared Contract

- [ ] Add `MediaCrawlerPlatform`, `MediaCrawlerLoginType`, `MediaCrawlerConfig`, `MediaCrawlerRunRequest`, `MediaCrawlerRunResult`.
- [ ] Add IPC channels `COMMENT_MEDIACRAWLER_CONFIG_GET`, `COMMENT_MEDIACRAWLER_CONFIG_SAVE`, `COMMENT_MEDIACRAWLER_TEST`, `COMMENT_MEDIACRAWLER_RUN`.
- [ ] Run `npm run typecheck`.

## Task 2: Command Builder

- [ ] Write failing tests for `xhs/dy/ks/bili/wb/tieba/zhihu`.
- [ ] Implement `buildMediaCrawlerCommand`.
- [ ] Verify platform maps to `--platform`, entryKind maps to `--type`, login maps to `--lt`.

## Task 3: Result Importer

- [ ] Write failing tests for JSON array, JSONL rows, and invalid records.
- [ ] Implement recursive output scan with conservative file filters.
- [ ] Normalize comment fields to YClaw `CommentItem` payloads.

## Task 4: External Executor

- [ ] Write failing tests using injected spawn function.
- [ ] Validate `repoPath/main.py`.
- [ ] Spawn Python with cwd set to MediaCrawler repo.
- [ ] Write stdout/stderr to `ExecutionLogService`.
- [ ] Import results after exit code 0.

## Task 5: IPC And App Wiring

- [ ] Extend `registerCommentHandlers` with MediaCrawler config/test/run handlers.
- [ ] Wire executor in `App`.
- [ ] Run `npx vitest run tests/unit/services/comment tests/unit/ipc/comment-handlers.spec.ts tests/unit/services/AppComposition.test.ts tests/unit/services/AppIpcIntegration.test.ts`.

## Task 6: Verification

- [ ] Run `npm run typecheck`.
- [ ] Run focused comment tests.
- [ ] Document manual usage: configure repo path, install MediaCrawler deps externally, run task.
