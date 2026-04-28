# YClaw 实现反查审计（2026-04-28）

> 目的：以当前仓库真实代码、脚本与测试为准，反查稳定文档是否齐全，并把“已做 / 未做 / 文档缺口”标清楚。  
> 审计范围：`README.md`、`AGENTS.md`、`docs/`、`src/`、`scripts/`、`tests/`。

---

## 1. 审计结论

| 结论 | 状态 | 说明 |
| --- | --- | --- |
| 仓库已是完整工程，不再是纯规划工作区 | `✅ 已做` | 已存在 `package.json`、Electron + Vite + TypeScript 主体代码、测试、构建与打包脚本 |
| 主线能力已有稳定文档承接 | `🟡 部分已做` | 自动化、Data Center、Task-as-Code、MCP、Headless Runner、Remote Runner、Runner Scheduler 均有 stable docs |
| 浏览器新业务承接文档不足 | `✅ 已补基础专项文档` | 已新增 `docs/specs/browser-hot-workspace-v1.md`，承接抖音分析台与 `HOT` 工作台 |
| 工程运行时文档不足 | `✅ 已补基础说明` | 已新增 `docs/architecture/dev-runtime.md`，说明 `predev`、端口与 Electron 启动链路 |
| 结构类文档存在滞后 | `🟡 已校准一部分` | 本轮已补 `src/cli/`、`src/mcp/`、`tests/integration/`、`hot` / `data-center` / `task-as-code` 等结构说明 |
| 仓库级工作说明存在过时内容 | `✅ 已修正` | `AGENTS.md` 中“仅 docs / 无 package.json / 无可运行脚本”的描述已不再成立，本轮已更新 |

---

## 2. 文档齐全度总表

| 文档 | 覆盖范围 | 当前判断 | 已做 / 未做标注情况 | 主要问题 |
| --- | --- | --- | --- | --- |
| `README.md` | 仓库入口、运行方式、主线能力 | `部分齐全` | `🟡` 已标部分实现状态 | 入口已较完整，但 `HOT` 工作台仍主要通过专项文档承接 |
| `docs/README.md` | `docs/` 导航与分类规则 | `基本齐全` | `🟡` 以导航为主 | 原先缺少“实现反查审计”入口，本轮已补 |
| `docs/overview/current-status.md` | 当前实现、限制、阅读顺序 | `基本齐全` | `✅` 本轮补强 | 原版本对 `HOT`、抖音分析台、单实例 / dev runtime 提及不足 |
| `docs/overview/roadmap.md` | 后续演进路线 | `齐全` | `🟡` 以阶段状态为主 | 主要回答“接下来做什么”，不是实现反查文档 |
| `docs/architecture/architecture.md` | 架构、进程模型、调用链路 | `部分齐全` | `🟡` | 主架构成立，工程运行时细节已拆到 `docs/architecture/dev-runtime.md` |
| `docs/architecture/dev-runtime.md` | 开发运行时、端口、Electron 启动链路 | `✅ 已补` | `✅` | 当前承接 `npm run dev`、`predev`、端口与故障排查说明 |
| `docs/architecture/structure.md` | 实际目录结构与职责 | `✅ 本轮校准` | `✅` | 原先未完整反映 `src/cli/`、`src/mcp/`、`tests/integration/`、`hot` 等目录 |
| `docs/product/prd.md` | 产品愿景、长期场景 | `齐全` | `⬜` 不以已做/未做为主 | 偏上位产品文档，不负责实现状态 |
| `docs/product/plan.md` | 阶段计划、可行性 | `齐全` | `⬜` 不以已做/未做为主 | 偏规划，不替代实现审计 |
| `docs/product/task-operations-center.md` | 小团队任务运营中台需求深化 | `部分齐全` | `🟡` | 与当前自动化主线一致，但未覆盖浏览器 `HOT` 新业务 |
| `docs/specs/v1.0-baseline.md` | 基线规格 | `部分齐全` | `🟡` | 仍有效，但无法覆盖后续新增的 Data Center / MCP / Runner / HOT 等扩展 |
| `docs/specs/v1.1-enhancements.md` | 增强规格 | `部分齐全` | `🟡` | 能覆盖部分增强项，但不是最新实现全景 |
| `docs/specs/automation-browser-ops-v1.md` | 自动化与浏览器主线 | `齐全` | `✅` | 浏览器子域细节已由 `docs/specs/browser-hot-workspace-v1.md` 补充承接 |
| `docs/specs/browser-hot-workspace-v1.md` | 浏览器 `HOT` 工作台与抖音分析台 | `✅ 已补` | `✅` | 现在已有稳定专项文档，而不是只依赖过程文档 |
| `docs/specs/task-operations-center-v1.md` | 任务运营中台 | `部分齐全` | `✅` | 覆盖任务运营闭环，不覆盖浏览器 `HOT` 专项 |
| `docs/specs/data-center-v1.md` | Data Center | `齐全` | `✅` | 有明确阶段与验收边界 |
| `docs/specs/task-as-code-v1.md` | Task-as-Code | `齐全` | `✅` | 文档、示例、README 链路较完整 |
| `docs/specs/mcp-integration-v1.md` | MCP Server / Client | `齐全` | `✅` | 稳定文档充分 |
| `docs/specs/headless-runner-v1.md` | CLI / daemon / headless runtime | `齐全` | `✅` | 稳定文档充分 |
| `docs/specs/remote-runner-control-plane-v1.md` | 远程执行控制面 | `齐全` | `✅` | 稳定文档充分 |
| `docs/specs/capacity-aware-runner-scheduler-v1.md` | 调度器 | `齐全` | `✅` | 稳定文档充分 |
| `docs/design/ai-assistant.md` | AI 助手设计 | `部分齐全` | `🟡` | 设计文档有效，但实现状态需以 `current-status.md` 为准 |
| `docs/design/data-center.md` | Data Center 上位设计 | `齐全` | `🟡` | 已由 spec / status 承接实现状态 |
| `docs/design/dashboard-ideas.md` | 总控页想法 | `未开始` | `⬜` | 仍是设计储备 |
| `docs/design/page-container-optimization.md` | 页面容器优化建议 | `未系统推进` | `⬜` | 仍是设计建议 |
| `docs/design/package-size-optimization.md` | 包体优化设计 | `部分已做` | `🟡` | 有 review 记录，但未形成完整工程说明 |
| `docs/superpowers/specs/2026-04-27-douyin-browser-analysis-design.md` | 抖音分析台过程设计 | `仅过程文档` | `🟡` | 可作为背景材料，但不应充当 stable docs |
| `AGENTS.md` | 仓库协作与结构说明 | `✅ 本轮校准` | `✅` | 原先内容严重过时，本轮已按真实工程更新 |

---

## 3. 实现反查矩阵

| 实现域 | 代表路径 | 当前状态 | 已有文档 | 未做 / 文档缺口 |
| --- | --- | --- | --- | --- |
| App Shell / 生命周期 | `src/main/index.ts` `src/main/app.ts` `src/main/bootstrap.ts` | `✅ 已做`：主进程启动、生命周期编排、窗口与服务装配已落地 | `current-status.md` `architecture.md` `structure.md` | 缺少单独说明 `bootstrapMainProcess` 装配关系的稳定文档 |
| 单实例治理 | `src/main/single-instance.ts` `tests/unit/services/single-instance.test.ts` | `✅ 已做`：二开实例抢锁与聚焦逻辑已落地 | `current-status.md` `structure.md` | 无独立专项说明，之前文档几乎未提及 |
| Workbench / 全局框架 | `src/renderer/entries/workbench/` `src/renderer/shared/components/AppProviders.tsx` | `✅ 已做`：主页、设置、命令面板、AI 面板、全局 loading 已存在 | `README.md` `current-status.md` | 无明显缺口 |
| 浏览器会话控制台 | `src/renderer/entries/browser/` `src/main/browser/TabManager.ts` | `✅ 已做`：标签、地址栏、干预、录制、WebView 容器已存在 | `automation-browser-ops-v1.md` `current-status.md` `architecture.md` | 仍缺更稳定的浏览器业务文档，尤其是新布局与双工作模式说明 |
| 抖音分析台 | `src/renderer/entries/browser/douyin/` `DouyinSearchPanel.tsx` `DouyinInsightPanel.tsx` | `✅ 已做基础版`：搜索样本、当前视频、评论分析、下载授权、回流草稿已存在 | `docs/specs/browser-hot-workspace-v1.md` | 真实后端搜索与下载持久化仍未做 |
| `HOT` 采集工作台 | `src/main/services/hot/` `src/main/ipc/hot-handlers.ts` `HotSourcePanel.tsx` `HotRunPanel.tsx` `HotReportPanel.tsx` | `✅ 已做基础版`：热榜源 CRUD、运行投影、报告生成、浏览器内嵌工作台已落地 | `docs/specs/browser-hot-workspace-v1.md` | 仍未独立为单独菜单或 renderer entry |
| 自动化 / 任务运营主线 | `src/main/services/*Task*` `src/renderer/entries/automation/` | `✅ 已做基础闭环`：任务、批次、结果、模板、告警、审核、值班、远程执行面板均存在 | `automation-browser-ops-v1.md` `task-operations-center-v1.md` `roadmap.md` | 主要是持续回写完成度，而不是缺文档 |
| Data Center | `src/main/services/data-center/` `src/renderer/entries/data-center/` | `✅ 已做 P0/P1 基础版`：结果资产、导出、Webhook、Token、本地只读 API、质量评分与洞察已在代码中 | `data-center-v1.md` `design/data-center.md` `current-status.md` | 文档整体齐全 |
| Task-as-Code | `src/shared/serialization/` `src/main/services/task-as-code/` `src/cli/lint.ts` | `✅ 已做基础版`：YAML、lint/import/export、watcher、Persistence 已存在 | `task-as-code-v1.md` `README.md` `src/shared/serialization/README.md` | 文档整体齐全 |
| AI / MCP | `src/main/ai/` `src/mcp/` `tests/integration/mcp/` | `✅ 已做基础版`：MCP server/client、嵌入式 HTTP、外部 tool 注册、危险确认与审计已存在 | `mcp-integration-v1.md` `design/ai-assistant.md` `current-status.md` | `structure.md` 原先未完整体现 `src/mcp/`，本轮已修正 |
| Headless Runner / Remote Runner / Scheduler | `src/runner/` `src/main/remote-runner/` `src/main/services/runner-scheduler/` | `✅ 已做基础版`：CLI、daemon、控制面、统一 Runner 池、dispatch、lease、reconcile 已存在 | `headless-runner-v1.md` `remote-runner-control-plane-v1.md` `capacity-aware-runner-scheduler-v1.md` | 文档整体齐全 |
| Plugin Center / Plugin Host / Feature Pack | `src/renderer/entries/plugin-center/` `src/renderer/plugin-host/` `scripts/build-feature-pack.ts` | `✅ 已做基础版`：插件生命周期、权限确认、宿主桥接、功能包构建链路已存在 | `README.md` `current-status.md` `structure.md` | 缺少单独的 feature pack / 安装治理文档 |
| Stock | `src/renderer/entries/stock/` `src/engines/analytics/` | `✅ 已做基础版`：K 线与指标能力已存在 | `README.md` `current-status.md` | 无独立 stable spec，但当前复杂度尚可接受 |
| Dev Runtime / Build Tooling | `scripts/dev.ts` `scripts/ensure-dev-runtime.cjs` `scripts/dist-win-core.ts` | `✅ 已做`：开发环境探测、Electron/Vite/tsc 联合启动、构建与分发脚本已存在 | `README.md` `package.json` `structure.md` `docs/architecture/dev-runtime.md` | feature pack 构建治理仍可后续继续细化 |
| 测试体系 | `tests/unit/` `tests/integration/` `tests/e2e/` | `✅ 已做`：单测、集成、e2e、脚本测试、序列化安全测试已存在 | `README.md` `structure.md` | `AGENTS.md` 之前仍按“仅规划仓库”描述测试状态，本轮已修正 |

---

## 4. 当前仍缺的稳定文档

| 优先级 | 建议文档 | 原因 | 建议承载内容 |
| --- | --- | --- | --- |
| `P1` | 插件 / 特性包分发说明 | 代码已存在 feature pack 构建与宿主机制 | 功能包产物位置、安装策略、窗口打开策略、错误提示约定 |
| `P2` | Stock 独立 spec | 目前只有总览级描述 | 若后续继续做回测、提醒、策略，再拆独立 spec |

---

## 5. 本轮已落地的文档校准

| 文件 | 本轮动作 |
| --- | --- |
| `docs/overview/implementation-audit.md` | 新增，实现反查总表与文档齐全度结论 |
| `docs/specs/browser-hot-workspace-v1.md` | 新增，承接浏览器 `HOT` 工作台与抖音分析台稳定规格 |
| `docs/architecture/dev-runtime.md` | 新增，承接 `npm run dev` 与运行时问题说明 |
| `docs/overview/current-status.md` | 补充文档反查结论、更新时间、浏览器 `HOT` / 抖音 / 单实例 / dev runtime 状态 |
| `docs/architecture/structure.md` | 校准真实目录结构，补 `src/cli/`、`src/mcp/`、`hot` / `data-center` / `task-as-code`、`tests/integration/` 等 |
| `docs/README.md` | 增加实现反查审计入口 |
| `AGENTS.md` | 修正“仅规划仓库 / 无脚本 / 无 package.json”等过时描述 |

---

## 6. 总结

| 判断 | 结论 |
| --- | --- |
| 文档是否齐全 | `基本齐全，但仍有细分工程文档可继续补` |
| 哪些主线已经有较完整文档 | 自动化、Task Ops、Data Center、Task-as-Code、MCP、Headless Runner、Remote Runner、Runner Scheduler |
| 哪些实现仍值得继续补文档 | feature pack / 插件分发治理、Stock 深化规格 |
| 本轮完成了什么 | 已把 `HOT` 工作台、抖音分析台和 dev runtime 从“缺 stable docs”状态推进到有专门文档承接 |
