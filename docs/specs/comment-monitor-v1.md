# SPEC · Comment Monitor V1

> 状态：首期闭环已落地。本文档是评论监控的稳定规格入口；过程设计请参考 `docs/superpowers/specs/2026-05-08-comment-monitor-design.md` 与 `docs/superpowers/specs/2026-05-08-mediacrawler-external-executor-design.md`。

## 1. 定位

| 项目 | 说明 |
| --- | --- |
| 模块入口 | `src/renderer/entries/comment-monitor/`，在 workbench 内以 `/comment-monitor` 路由加载 |
| 主进程子域 | `src/main/services/comment/`、`src/main/ipc/comment-handlers.ts` |
| 共享类型 | `src/shared/types/comment.ts` |
| 数据承载 | 评论源和报告有独立 repository；评论结果复用 `ExtractionResult` 结构化 payload |
| 目标 | 创建评论源、启动采集、查看评论结果、生成报告、辅助生成 AI 回复 |

## 2. 当前已落地能力

| 能力 | 状态 | 代表实现 |
| --- | --- | --- |
| 评论监控菜单与路由 | 已做 | `AdminPageLayout`、`workbench/App.tsx`、`WindowManager` |
| 评论源管理 | 已做 | `CommentSourceService`、`CommentSourceRepository` |
| 评论任务编译 | 已做 | `CommentTaskCompiler` |
| 运行投影 | 已做 | `CommentRunProjectionService` |
| 评论结果列表 | 已做 | `COMMENT_RESULT_LIST` IPC 与 `CommentMonitorApp` |
| 评论报告 | 已做 | `CommentReportService`、`CommentReportRepository` |
| AI 回复草稿 | 已做 | `CommentAiReplyService` |
| MediaCrawler 外部执行器 | 已做 | `MediaCrawlerCommandBuilder`、`MediaCrawlerExternalExecutor`、`MediaCrawlerResultImporter` |

## 3. 主链路

| 步骤 | 行为 |
| --- | --- |
| 1 | 用户进入“评论监控”，创建评论源并配置平台、入口、限制和过滤条件 |
| 2 | `CommentSourceService` 保存源，并通过 `CommentTaskCompiler` 生成底层任务 |
| 3 | 用户启动运行，系统创建 batch 并按源配置执行采集 |
| 4 | 结果按评论粒度写入统一结果管线 |
| 5 | 页面按 batch 展示评论列表、作者、点赞、IP 属地和父评论关系 |
| 6 | 用户生成 Markdown/HTML 报告，或对单条评论生成 AI 回复草稿 |
| 7 | 可选：配置本地 MediaCrawler 仓库后，调用外部 Python 执行器导入 JSON/JSONL 评论结果 |

## 4. 范围边界

| 范围 | 当前状态 |
| --- | --- |
| 平台 | 页面配置已支持小红书、抖音等评论平台枚举；首期稳定能力以小红书/抖音语义为主 |
| 外部执行器 | 只调用用户本地已有 MediaCrawler 仓库，不复制其源码，不代装依赖 |
| 登录态 | 由用户自行在目标平台或外部工具中完成登录、验证码和风控处理 |
| 自动互动 | 不提供自动点赞、自动私信、自动发布回复 |
| 结果导出 | 当前以报告和结果管线为主，复杂数据集导出交由 Data Center 主线承接 |

## 5. 测试覆盖

| 测试 | 覆盖 |
| --- | --- |
| `tests/unit/services/comment/CommentTaskCompiler.test.ts` | 评论源到任务步骤的编译 |
| `tests/unit/services/comment/CommentSourceService.test.ts` | 评论源 CRUD 与任务同步 |
| `tests/unit/services/comment/CommentRunProjectionService.test.ts` | 运行摘要投影 |
| `tests/unit/services/comment/CommentReportService.test.ts` | 报告生成 |
| `tests/unit/services/comment/CommentAiReplyService.test.ts` | AI 回复草稿 |
| `tests/unit/services/comment/MediaCrawler*.test.ts` | 外部执行器命令、运行和导入 |
| `tests/unit/ipc/comment-handlers.spec.ts` | IPC payload 与服务调用边界 |
| `tests/unit/components/CommentMonitorApp.test.tsx` | 页面加载、创建源、运行、报告和外部执行器交互 |

## 6. 未完成项

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 多平台深度适配 | 未完整 | 七平台外部执行命令已接入，但平台专属展示和字段治理仍需继续扩展 |
| 二级评论线程视图 | 未做完整 | 当前有二级评论开关和父评论字段，尚未形成完整线程 UI |
| MCP 评论查询工具 | 未做 | 后续可增加 `comment.latest`、`comment.summary` 等只读能力 |
| 报告导出格式 | 未做完整 | 当前以 Markdown/HTML 为主，未做 docx |

