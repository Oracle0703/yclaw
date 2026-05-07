# 热点监控 · TrendRadar 等价迁移计划

> 来源仓库：`https://github.com/Oracle0703/TrendRadar`  
> 审查版本：`b109701` / TrendRadar `v6.6.2`  
> 集成路线：等价重实现，不直接复制 TrendRadar GPL-3.0 源码。

## 目标

| 项目 | 说明 |
| --- | --- |
| 顶级入口 | 在 YClaw 侧边栏新增“热点监控”菜单，路由为 `/hot-monitor` |
| 初始能力 | 复用现有 HOT IPC、采集源、运行、报告能力，形成独立工作台 |
| 完整迁移方向 | 按 TrendRadar 功能语义重建热榜/RSS、关键词/AI 筛选、调度、通知、MCP 查询与报告体验 |
| 许可证边界 | 本项目保持 MIT；TrendRadar 作为功能参考，不复制其 GPL-3.0 代码实现 |

## 当前落地范围

| 能力 | 状态 | 证据 |
| --- | --- | --- |
| “热点监控”侧边栏菜单 | 已完成 | `src/renderer/shared/components/AdminPageLayout.tsx` |
| Workbench 内部路由 | 已完成 | `src/renderer/entries/workbench/App.tsx` |
| 独立页面 | 已完成 | `src/renderer/entries/hot-monitor/App.tsx` |
| HOT 源/运行/报告面板 | 已完成 | 复用 `HotSourcePanel`、`HotRunPanel`、`HotReportPanel` |
| 命令面板跳转 | 已完成 | `nav:hot-monitor` |
| 主进程窗口导航 | 已完成 | `WindowManager` 将 `hot-monitor` 作为 workbench 内置模块 |
| NewsNow 预设源 | 已完成 | `src/renderer/entries/hot-monitor/newsnowPresets.ts` |
| NewsNow API 抓取解析 | 已完成 | `AutomationEngine` 支持 `mode: api` + `parserKey: newsnow.hot` |
| 热榜条目落库 | 已完成 | API 抽取结果按条目拆分保存为 `ExtractionResult` |
| RSS 抓取解析 | 已完成 | `parserKey: rss.feed`、`HotRssParser`、RSS 预设入口 |
| 关键词过滤 | 已完成 | `HotFilterService` 支持关键词组、过滤词、新增标记 |
| Timeline 预设 | 已完成 | `HotTimelineScheduler` 支持全天、早晚、工作日、自定义基础预设，并已通过 `HOT_TIMELINE_PRESETS` 接入页面 |
| AI 摘要边界 | 已完成 | `HotAiInsightService` 接入全局 AI 服务，并已通过 `HOT_AI_SUMMARIZE` 接入页面 |
| 报告搜索预览 | 已完成 | 报告详情可读取内容，页面内支持搜索、Markdown 预览和 TrendRadar 风格 HTML 报告打开 |
| 通知出口 | 已完成 | `HotNotificationService` 复用数据中心 webhook delivery，并已通过 `HOT_NOTIFICATION_SEND` 接入页面 |
| MCP 热点查询 | 已完成 | `hot.latest`、`hot.trends`、`hot.summary` |

## 后续完整迁移阶段

| 阶段 | 交付物 | 关键文件方向 | 验收标准 |
| --- | --- | --- | --- |
| P1 NewsNow 热榜源 | 内置平台源清单、抓取器、解析器 | `src/renderer/entries/hot-monitor/`、`src/engines/automation/`、`src/main/services/hot/` | 已接入知乎、微博、华尔街见闻、抖音预设；API 源可通过 `fetch` 抓取 NewsNow JSON，解析为 `title/url/mobileUrl/rank/sourceId/updatedTime/heat` 并逐条落库 |
| P2 RSS 支持 | RSS 源管理、抓取、去重、新增检测 | `HotRssParser`、`AutomationEngine`、`HotSourcePanel` | 已支持新增 RSS 源、抓取 RSS/Atom、按关键词筛选、标记新增；后续可补 RSS 源批量导入 |
| P3 关键词与展示规则 | 关键词组、过滤词、按平台/关键词展示 | `HotFilterService`、`HotSourcePanel` | 已支持默认关键词组、过滤词、结果字段标记；后续可补多组可视化管理 |
| P4 Timeline 调度 | 时间段、日计划、周映射、一次性控制 | `HotTimelineScheduler`、`hot-handlers`、`HotMonitorApp` | 已提供全天、早晚、工作日、自定义预设和 cron 映射；页面可一键应用预设到采集源草稿；后续可补更细的可视化时间轴 |
| P5 AI 筛选/分析/翻译 | 复用本项目 AI 服务，补热点专用 prompt 与缓存 | `HotAiInsightService`、`hot-handlers`、`HotMonitorApp` | 已接入全局 AI 服务、兴趣描述 prompt、匹配结果摘要；页面可对选中/最新批次生成 AI 摘要；后续可补摘要缓存和翻译 |
| P6 报告体验 | HTML/Markdown 报告预览、暗色、搜索、复制 | `HotReportService`、`HotReportPanel` | 已支持 Markdown 报告结构化摘要、内容读取、页面搜索和预览；HTML 报告按 `output/html/YYYY-MM-DD/HH-mm.html` 与 `output/html/latest/current.html` 生成，并支持暗色、宽屏、搜索和 `#tab-N` |
| P7 通知出口 | 复用数据中心 Webhook/邮件等出口 | `HotNotificationService`、`hot-handlers`、`HotMonitorApp` | 已复用数据中心 webhook delivery、支持重试边界；页面可将最新/预览报告发送到 webhook；后续可补数据中心目标选择和邮件出口 |
| P8 MCP 查询工具 | 热点数据资源与查询工具 | `src/mcp/` | 已支持 `hot.latest`、`hot.trends`、`hot.summary` 查询最新热点、趋势和摘要 |

## 测试门槛

| 类别 | 命令 | 覆盖目标 |
| --- | --- | --- |
| 组件测试 | `npx vitest run tests/unit/components/*Hot* tests/unit/components/CommandPalette.test.tsx` | 页面、菜单、命令入口 |
| 主进程测试 | `npx vitest run tests/unit/services/WindowManager.test.ts tests/unit/ipc/hot-handlers.spec.ts` | 窗口导航与 HOT IPC |
| 引擎测试 | `npx vitest run tests/unit/engines/AutomationEngine.test.ts tests/unit/engines/FlowRunner.test.ts tests/unit/services/HotTaskCompiler.test.ts` | NewsNow API 抓取、解析、上下文传递与任务编译 |
| P2-P8 服务测试 | `npx vitest run tests/unit/services/hot/HotCapabilities.test.ts tests/integration/mcp/server.spec.ts` | RSS、关键词、Timeline、AI、通知、MCP 查询 |
| 类型检查 | `npm run typecheck` | 新页面、类型、路由编译 |
| 构建 | `npm run build` | Workbench lazy route 与 Electron 主进程产物 |
