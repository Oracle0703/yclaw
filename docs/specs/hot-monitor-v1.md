# SPEC · Hot Monitor V1

> 状态：热点监控基础版已落地。本文档是独立热点监控入口的稳定规格；TrendRadar 等价迁移过程见 `docs/plans/hot-monitor-trendradar-migration.md`。

## 1. 定位

| 项目 | 说明 |
| --- | --- |
| 模块入口 | `src/renderer/entries/hot-monitor/`，在 workbench 内以 `/hot-monitor` 路由加载 |
| 浏览器内嵌入口 | `browser` 模块仍保留 `HOT` 采集工作台，用于浏览器采集场景 |
| 主进程子域 | `src/main/services/hot/`、`src/main/ipc/hot-handlers.ts` |
| 共享类型 | `src/shared/types/hot.ts` |
| 目标 | 热点源配置、运行、结果查看、报告生成、AI 摘要、通知出口和 MCP 查询 |

## 2. 当前已落地能力

| 能力 | 状态 | 代表实现 |
| --- | --- | --- |
| 独立菜单与路由 | 已做 | `AdminPageLayout`、`workbench/App.tsx`、`WindowManager` |
| 热点源 CRUD | 已做 | `HotSourceService`、`HotSourceRepository` |
| 运行投影 | 已做 | `HotRunProjectionService` |
| 报告生成与预览 | 已做 | `HotReportService`、`HotReportPanel` |
| NewsNow 预设 | 已做 | `newsnowPresets.ts` |
| API/RSS 解析 | 已做 | `parserKey: newsnow.hot`、`parserKey: rss.feed` |
| 关键词过滤 | 已做 | `HotFilterService` |
| Timeline 预设 | 已做 | `HotTimelineScheduler` |
| AI 摘要 | 已做 | `HotAiInsightService` 与 `HOT_AI_SUMMARIZE` |
| 通知出口 | 已做 | `HotNotificationService` 复用 Data Center webhook delivery |
| MCP 查询 | 已做 | `hot.latest`、`hot.trends`、`hot.summary` |

## 3. 主链路

| 步骤 | 行为 |
| --- | --- |
| 1 | 用户进入“热点监控”，创建单平台或多平台热点源 |
| 2 | 系统根据源配置生成自动化任务，支持 API/RSS 抓取和解析 |
| 3 | 用户启动运行或应用 Timeline 预设 |
| 4 | 结果写入统一 batch/result 管线，并由运行投影服务展示摘要 |
| 5 | 用户生成 Markdown 或 TrendRadar 风格 HTML 报告 |
| 6 | 可选调用 AI 摘要，对最新或选中批次生成热点总结 |
| 7 | 可选发送热点通知，或通过 MCP 查询最新热点、趋势和摘要 |

## 4. 与 Browser HOT Workspace 的关系

| 模块 | 责任 |
| --- | --- |
| `docs/specs/browser-hot-workspace-v1.md` | 说明浏览器模块内部的 `HOT` 工作台和抖音分析台双模式 |
| `docs/specs/hot-monitor-v1.md` | 说明独立“热点监控”入口、TrendRadar 风格能力和长期热点运营闭环 |

两者复用 HOT 服务、IPC、类型与结果管线；区别在于浏览器入口偏采集现场，热点监控入口偏运营配置、报告、通知和查询。

## 5. 范围边界

| 范围 | 当前状态 |
| --- | --- |
| 数据源 | 已支持 NewsNow 风格 API、RSS/Atom 和多平台预设 |
| 报告 | 已支持 Markdown 与 HTML 快照；docx 仍不在 V1 范围 |
| 调度 | Timeline 预设已可用，更复杂的后台常驻调度策略仍可增强 |
| 通知 | 复用 Data Center webhook；邮件、企业微信等精细出口可后续扩展 |
| 许可 | 参考 TrendRadar 功能语义重建，不复制 GPL-3.0 源码 |

## 6. 测试覆盖

| 测试 | 覆盖 |
| --- | --- |
| `tests/unit/components/HotMonitorApp.test.tsx` | 热点监控页面、源配置、运行、报告、AI、通知 |
| `tests/unit/ipc/hot-handlers.spec.ts` | HOT IPC 边界 |
| `tests/unit/services/HotSourceService.test.ts` | 热点源服务 |
| `tests/unit/services/HotRunProjectionService.test.ts` | 运行投影 |
| `tests/unit/services/HotReportService.test.ts` | Markdown/HTML 报告 |
| `tests/unit/services/hot/HotCapabilities.test.ts` | RSS、过滤、Timeline 等能力 |
| `tests/unit/services/hot/TrendRadarConfigService.test.ts` | TrendRadar 风格配置映射 |
| `tests/integration/mcp/server.spec.ts` | MCP 热点查询能力 |

## 7. 未完成项

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 可视化时间轴编辑 | 未完整 | 已有预设，复杂编辑器仍可增强 |
| 多通知目标选择 | 未完整 | 当前可复用 webhook delivery，精细目标选择可继续接 Data Center |
| 摘要缓存和翻译 | 未完整 | AI 摘要已接入，长期缓存和翻译不在 V1 首期 |
| docx 报告 | 未做 | 当前报告以 Markdown/HTML 为主 |

