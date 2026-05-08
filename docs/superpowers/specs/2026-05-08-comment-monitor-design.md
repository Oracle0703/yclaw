# 评论监控 · MediaCrawler 等价迁移设计

> 来源仓库：`https://github.com/NanmiCoder/MediaCrawler`  
> 审查版本：`f328ee3` / `main`  
> 集成路线：按功能语义等价重建，不直接复制 MediaCrawler 源码。

## 1. 目标

| 项目 | 说明 |
| --- | --- |
| 顶级入口 | 在 YClaw 侧边栏新增“评论监控”菜单，路由为 `/comment-monitor` |
| 首期平台 | 小红书优先，后续再扩展抖音、B 站、微博等平台 |
| 首期闭环 | 新建评论源 → 启动采集 → 保存评论结果 → 查看评论列表 → 生成评论洞察报告 |
| 迁移方式 | 参考 MediaCrawler 的平台、入口、内容、评论、创作者抽象，在本项目内用 TypeScript/Electron 原生实现 |
| 合规边界 | 默认小批量、限速、人工登录态，不做大规模爬取或自动化骚扰行为 |

## 2. 上游调研结论

| 项目 | MediaCrawler 现状 | 对 YClaw 的影响 |
| --- | --- | --- |
| 技术栈 | Python + Playwright + CDP 浏览器模式 | 不适合直接嵌入 Electron 打包链路 |
| 平台范围 | 小红书、抖音、快手、B 站、微博、贴吧、知乎 | 首期只迁移小红书评论监控，避免一次性扩大风险 |
| 入口类型 | `search`、`detail`、`creator` | 映射为评论源的关键词、指定链接、创作者主页三类入口 |
| 评论能力 | 一级评论默认开启，二级评论可选 | 首期支持一级评论，二级评论作为源配置开关保留 |
| 登录态 | 二维码、手机号、Cookie、CDP 复用本地浏览器 | 首期复用 YClaw 浏览器会话和人工登录态 |
| 存储 | 内容、评论、创作者分表，支持 json/jsonl/db/sqlite 等 | YClaw 复用 Task/Batch/Result，并新增评论源与报告元数据 |
| 许可证 | 非商业学习使用许可证 1.1 | 不复制源码，只做等价重建和文档引用 |

## 3. 产品范围

| 范围 | 首期做 | 首期不做 |
| --- | --- | --- |
| 平台 | 小红书 | 抖音、快手、B 站、微博、贴吧、知乎 |
| 入口 | 关键词、笔记链接、创作者主页 | 多账号池、代理池、大规模任务编排 |
| 评论 | 一级评论、数量上限、可选二级评论配置 | 自动回复、自动点赞、自动私信 |
| 结果 | 评论列表、作者、时间、点赞数、IP 属地、父评论 ID | 媒体资源下载 |
| 洞察 | 高频词、情绪倾向、风险提示、代表评论 | 复杂舆情模型训练 |
| 报告 | Markdown/HTML 评论洞察报告 | docx 导出 |

## 4. 架构设计

评论监控沿用热点监控的模块形态，但不与 HOT 类型混用，避免后续平台采集语义互相污染。

| 层级 | 新增/修改方向 | 职责 |
| --- | --- | --- |
| 菜单与路由 | `AdminPageLayout.tsx`、`workbench/App.tsx`、`WindowManager.ts` | 新增“评论监控”入口与 `/comment-monitor` 路由 |
| Renderer 页面 | `src/renderer/entries/comment-monitor/App.tsx` | 评论源配置、运行列表、结果预览、报告入口 |
| Shared 类型 | `src/shared/types/comment.ts` | 评论源、运行摘要、评论结果、报告类型 |
| IPC 常量 | `src/shared/constants/channels.ts` | 新增 `comment:*` 通道 |
| IPC handler | `src/main/ipc/comment-handlers.ts` | 校验 renderer payload，转发给评论服务 |
| Main 服务 | `src/main/services/comment/*` | 源管理、任务编译、运行投影、报告生成、洞察摘要 |
| Repository | `CommentSourceRepository.ts`、`CommentReportRepository.ts` | 评论源和报告元数据持久化 |
| 自动化引擎 | `AutomationEngine.ts` | 增加 `parserKey: xhs.comment` 的轻量解析入口 |

## 5. 数据模型

### 5.1 评论源

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 评论源 ID |
| `taskId` | `string` | 绑定的自动化任务 ID |
| `name` | `string` | 用户可读名称 |
| `platform` | `'xhs'` | 首期固定小红书 |
| `entryKind` | `'keyword' \| 'note' \| 'creator'` | 关键词、指定笔记、创作者主页 |
| `entryValue` | `string` | 关键词、URL 或创作者主页地址 |
| `parserKey` | `string` | 首期为 `xhs.comment` |
| `sessionId` | `string \| null` | 可选浏览器会话 |
| `schedule` | `ScheduleConfig \| null` | 复用任务调度配置 |
| `limits` | `CommentCrawlLimits` | 笔记数、一级评论数、二级评论开关、间隔秒数 |
| `filter` | `CommentFilterConfig \| null` | 包含词、排除词、最低点赞数 |
| `enabled` | `boolean` | 是否启用 |
| `tags` | `string[]` | 用户标签 |

### 5.2 评论结果

评论结果首期作为 `ExtractionResult` 的结构化 payload 保存，不新增大表，降低迁移成本。payload 使用统一字段：

| 字段 | 说明 |
| --- | --- |
| `platform` | 平台，首期为 `xhs` |
| `sourceId` | 评论源 ID |
| `contentId` | 笔记 ID |
| `contentUrl` | 笔记 URL |
| `contentTitle` | 笔记标题 |
| `commentId` | 评论 ID |
| `parentCommentId` | 父评论 ID，一级评论为空 |
| `content` | 评论正文 |
| `authorId` | 评论作者 ID |
| `authorName` | 评论作者昵称 |
| `avatar` | 评论作者头像 |
| `createdAt` | 评论发布时间 |
| `likeCount` | 点赞数 |
| `ipLocation` | IP 属地 |
| `subCommentCount` | 二级评论数量 |

### 5.3 评论报告

| 字段 | 说明 |
| --- | --- |
| `id` | 报告 ID |
| `sourceId` | 评论源 ID |
| `batchId` | 运行批次 ID |
| `title` | 报告标题 |
| `format` | `md` 或 `html` |
| `filePath` | 文件路径 |
| `content` | 预览内容，可选 |
| `createdAt` | 创建时间 |

## 6. 主链路

| 步骤 | 说明 |
| --- | --- |
| 1 | 用户在评论监控页创建小红书评论源 |
| 2 | `CommentSourceService` 调用 `CommentTaskCompiler` 生成自动化任务 |
| 3 | 用户启动评论源运行，复用 `TaskService` 创建 batch |
| 4 | 自动化步骤打开小红书页面，执行 `xhs.comment` 提取 |
| 5 | 提取结果按评论粒度写入 `ExtractionResult` |
| 6 | 页面加载运行详情和评论结果列表 |
| 7 | 用户生成报告，`CommentReportService` 产出 Markdown/HTML |

## 7. 小红书首期采集策略

首期不做签名逆向，也不复制 MediaCrawler 的 Python client。策略是以浏览器会话为边界：

| 场景 | 实现方式 |
| --- | --- |
| 关键词入口 | 打开小红书搜索页，基于可见内容和页面上下文提取笔记样本 |
| 笔记链接入口 | 打开指定笔记，提取页面可见评论 |
| 创作者主页入口 | 打开主页，提取可见笔记列表，再逐条进入评论页 |
| 登录态 | 用户通过 YClaw 浏览器手动登录，任务绑定 sessionId |
| 限速 | 每页和每条笔记之间按配置等待 |
| 失败处理 | 未登录、验证码、风控、页面结构变化时标记 batch 失败并保留截图/DOM 快照 |

## 8. 错误处理

| 错误 | 行为 |
| --- | --- |
| 未配置入口 | IPC 层拒绝，返回 `entryValue is required` |
| 平台不支持 | IPC 层拒绝，首期只接受 `xhs` |
| 未登录或验证码 | 运行失败，错误写入 batch，并提示需要人工登录/复核 |
| 页面无评论 | 运行成功但结果数为 0，报告显示“未采集到评论” |
| 报告文件写入失败 | 抛出服务错误，不写入报告元数据 |

## 9. 测试策略

| 测试 | 覆盖 |
| --- | --- |
| `CommentTaskCompiler.test.ts` | 不同入口类型编译为正确任务步骤 |
| `CommentSourceService.test.ts` | 创建、更新、删除评论源会同步底层任务 |
| `comment-handlers.spec.ts` | IPC payload 校验和服务调用 |
| `CommentReportService.test.ts` | 评论结果生成 Markdown/HTML 报告 |
| `CommentMonitorApp.test.tsx` | 页面加载、创建源、启动运行、生成报告 |
| `AdminPageLayout.test.tsx` | 菜单出现“评论监控”并导航 |
| `WindowManager.test.ts` | `comment-monitor` 复用 workbench 路由 |
| `npm run typecheck` | 类型边界完整 |

## 10. 后续扩展

| 阶段 | 内容 |
| --- | --- |
| P1 | 扩展抖音评论监控，复用现有浏览器抖音分析台经验 |
| P2 | 把评论洞察接入全局 AI 服务，支持自定义关注点 |
| P3 | 支持二级评论可视化、评论线程视图 |
| P4 | 支持导入外部 MediaCrawler JSONL 结果，但作为可选导入器，不作为运行时依赖 |
| P5 | MCP 暴露 `comment.latest`、`comment.summary` 查询工具 |

## 11. 验收标准

| 验收项 | 标准 |
| --- | --- |
| 菜单入口 | 左侧菜单有“评论监控”，点击进入 `/comment-monitor` |
| 创建源 | 能创建小红书评论源，并同步创建底层任务 |
| 启动运行 | 能从评论源启动任务，并在运行列表看到 batch |
| 查看结果 | 能按 batch 查看评论结果列表 |
| 生成报告 | 能生成 Markdown/HTML 评论洞察报告并在页面预览 |
| 边界限制 | 默认限制数量和间隔，页面明确不提供自动回复能力 |
| 测试 | 评论监控相关单测通过，`npm run typecheck` 通过 |
