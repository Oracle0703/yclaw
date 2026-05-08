# 📌 YClaw 当前实现现状

> 本文档描述仓库**当前已经落地的实现**、工程运行方式、已知限制与后续重点。  
> 若需查看产品愿景与长期规划，请阅读 `docs/product/prd.md`、`docs/product/plan.md`、`docs/specs/v1.0-baseline.md`。

---

## 1. 文档定位

| 文档                                                  | 作用                                    | 适用场景                                  |
| ----------------------------------------------------- | --------------------------------------- | ----------------------------------------- |
| `docs/overview/current-status.md`                     | 当前代码实现与工程状态                  | 想知道“现在做到哪了”                      |
| `docs/overview/implementation-audit.md`               | 实现反查与文档齐全度审计                | 想知道“哪些实现已有文档、哪些还缺文档”    |
| `docs/README.md`                                      | `docs/` 文档总索引                      | 想知道“还有哪些资料”                      |
| `docs/architecture/architecture.md`                   | 技术分层、调用链路、进程模型            | 想了解“系统怎么工作”                      |
| `docs/architecture/structure.md`                      | 实际目录结构与模块职责                  | 想快速定位代码                            |
| `docs/architecture/dev-runtime.md`                    | `npm run dev` 启动链路与运行时问题说明  | 想排查 dev 环境、端口和 Electron 启动问题 |
| `docs/architecture/feature-pack-plugin-governance.md` | 功能包与插件分发治理说明                | 想了解模块拆包、插件安装和权限边界        |
| `docs/product/prd.md`                                 | 产品愿景、角色、场景                    | 想了解“为什么做这个项目”                  |
| `docs/product/plan.md`                                | 可行性分析与阶段路线                    | 想了解“整体怎么推进”                      |
| `docs/specs/v1.0-baseline.md`                         | 基线规格与验收目标                      | 想了解“V1.0 要交付什么”                   |
| `docs/specs/v1.1-enhancements.md`                     | 增强项规格                              | 想了解“V1.1 之后补什么”                   |
| `docs/specs/browser-hot-workspace-v1.md`              | 浏览器 `HOT` 工作台与抖音分析台稳定规格 | 想了解浏览器采集台内部双工作模式          |
| `docs/specs/stock-analysis-v1.md`                     | 股票分析模块稳定规格                    | 想了解 `stock` 模块当前真实边界           |

---

## 2. 当前状态总览

| 维度         | 当前状态             | 说明                                                                                                  |
| ------------ | -------------------- | ----------------------------------------------------------------------------------------------------- |
| 项目形态     | 已进入可运行开发阶段 | 不再是纯规划仓库，已包含完整 `package.json`、`src/`、`tests/`                                         |
| 桌面壳       | 已实现               | Electron 主进程、窗口管理、托盘、更新服务已落地                                                       |
| 渲染层       | 已实现               | React + Vite 多入口结构已建立                                                                         |
| IPC 边界     | 已实现               | 主进程 / preload / 渲染进程之间已有类型化 IPC 通道                                                    |
| 核心引擎     | 已实现基础能力       | 自动化引擎、分析引擎已具备基础执行与测试覆盖                                                          |
| AI 助手      | 已实现基础版本       | 包含服务层、工具注册、聊天面板                                                                        |
| 插件体系     | 已实现基础版本       | 已有插件加载、权限校验、插件中心、插件宿主                                                            |
| 浏览器采集台 | 已实现基础版本       | 浏览器入口已具备会话控制台、抖音分析台与 `HOT` 采集工作台双模式                                       |
| 热点监控     | 已实现基础版本       | 独立 `hot-monitor` 入口，提供热点源配置、运行与报告生成                                               |
| 评论监控     | 已实现首期闭环       | 独立 `comment-monitor` 入口，提供评论源、运行、AI 回复与报告管理；MediaCrawler 外部执行器作为采集后端 |
| 启动治理     | 已实现基础版本       | `bootstrapMainProcess`、单实例抢锁、`predev` 运行时检查均已落地                                       |
| 测试体系     | 已建立               | 包含 Vitest 单测、回归测试、Playwright e2e                                                            |
| 打包能力     | 已建立               | 支持 `build`、`pack`、`dist` 与多平台打包脚本                                                         |

---

## 2.1 文档反查结论（截至 2026-04-28）

| 结论                  | 当前状态           | 说明                                                                                                           |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| 主线文档覆盖          | 基本齐全           | 自动化、Task Ops、Data Center、Task-as-Code、MCP、Headless Runner、Remote Runner、Scheduler 均已有 stable docs |
| 浏览器新业务文档      | 已补齐基础专项文档 | 已新增 `docs/specs/browser-hot-workspace-v1.md` 承接 `HOT` 工作台与抖音分析台                                  |
| 股票分析文档          | 已补齐基础专项文档 | 已新增 `docs/specs/stock-analysis-v1.md` 承接 `stock` 模块当前真实边界                                         |
| 工程运行时文档        | 已补齐基础说明     | 已新增 `docs/architecture/dev-runtime.md` 说明 `predev`、端口与 Electron 启动链路                              |
| 功能包 / 插件治理文档 | 已补齐基础说明     | 已新增 `docs/architecture/feature-pack-plugin-governance.md` 说明分发、安装落点与权限边界                      |
| 结构说明              | 已补强             | `docs/architecture/structure.md` 已回写 `src/cli/`、`src/mcp/`、`tests/integration/` 等真实结构                |
| 详细审计              | 已新增             | 详见 `docs/overview/implementation-audit.md`                                                                   |

---

## 2.2 规格 / 方案落地状态（截至 2026-04-28）

| 文档                                                  | 当前状态                           | 实现情况                                                                                                                                                                                                                                                                                                                                                         | 说明                                                                                 |
| ----------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `docs/specs/v1.0-baseline.md`                         | 已落地基础版                       | Electron 壳、Vite 多入口、IPC、数据库、浏览器、自动化、插件、AI 基础能力均已存在                                                                                                                                                                                                                                                                                 | 仍有少量交互与打包态验收需继续核验                                                   |
| `docs/specs/v1.1-enhancements.md`                     | 部分完成                           | 命令面板、AI 面板、设置页增强、多数运营/浏览器增强已进入代码                                                                                                                                                                                                                                                                                                     | 文档中的部分 UI 勾选项仍需与真实实现继续对齐                                         |
| `docs/specs/automation-browser-ops-v1.md`             | 部分完成到基础闭环                 | 任务、批次、结果、会话、告警、执行日志、介入面板、模板等主链路已具备基础版                                                                                                                                                                                                                                                                                       | 完整 Electron 成品态验收和部分深水区交互仍待补齐                                     |
| 京东签到能力                                          | 部分完成到可验证闭环               | 已完成共享类型、任务持久化、最新运行记录持久化、运行历史列表 UI、京东 API/浏览器补领链路、主进程 IPC/调度分流、Automation 签到面板/状态卡、Settings SMTP 配置与 SMTP 客户端接入                                                                                                                                                                                  | 真实 SMTP 服务联调、历史记录分页/筛选等增强仍未完成                                  |
| `docs/specs/browser-hot-workspace-v1.md`              | 基础版已落地                       | 浏览器 `HOT` 工作台、抖音分析台、双工作模式、IPC 与数据模型边界已有稳定文档承接                                                                                                                                                                                                                                                                                  | 当前仍未独立成单独菜单或 renderer entry                                              |
| `docs/specs/stock-analysis-v1.md`                     | 基础版已落地                       | 股票分析模块的 K 线工作台、指标、数据源边界与未完成项已有稳定文档承接                                                                                                                                                                                                                                                                                            | 当前仍不是完整投研终端                                                               |
| `docs/specs/task-as-code-v1.md`                       | 基础版已落地 / UI 待补             | 核心序列化、CLI、IPC、preload 桥接、目录监听、Persistence 适配、README quick-start 与示例已落地                                                                                                                                                                                                                                                                  | 任务中心 / 模板中心 UI 导入导出入口、shutdown 等少量防御性尾项仍待补齐               |
| `docs/specs/mcp-integration-v1.md`                    | 基础版已落地 / 验收收尾            | MCP Server `stdio/http`、token 鉴权、dangerous 标记、外部 MCP Client、设置页、AI 工具可见性、审计面板、Claude/Cursor 示例已落地                                                                                                                                                                                                                                  | 最终逐条验收、资源/审计筛选和远程访问边界仍待收口                                    |
| `docs/specs/data-center-v1.md`                        | P0 已可用 / P1.5 持续完善中        | 已具备独立 `data-center` 模块、结果资产总览、结果详情、持久化导出任务、状态筛选、取消任务、失败重试、导出创建弹窗、数据集保存、本地只读 API、Webhook 目标保存/编辑/删除/连通性测试、API Token 生成/列表/模板/吊销、Webhook 导出底层链路、token 校验底层预留、数据质量一键扫描、质量规则启停配置、质量评分、批次洞察、findings / insight 持久化、自动化页跳转入口 | Token 更细权限治理、Webhook 更完整配置治理、复杂规则编辑器与长期趋势洞察仍属后续阶段 |
| `docs/design/data-center.md`                          | 方案已转入实现并持续回写           | 数据中心的信息架构、导出任务模型、Webhook / Token / 本地 API 边界已形成专项主线，并由 `docs/specs/data-center-v1.md` 与 `docs/plans/data-center-v1.md` 承接落地                                                                                                                                                                                                  | 设计文档保留作上位方案说明，后续以 spec / status 为准同步现状                        |
| `docs/specs/headless-runner-v1.md`                    | HR-M1 CLI 可用 / HR-M2 daemon 雏形 | 已落地 `src/runner/cli/list.ts`、`src/runner/cli/run.ts`、`src/runner/cli/daemon.ts`、基础 Playwright adapter 与最小 `RemoteRunnerServer`，支持本地直连 SQLite 执行和最小 daemon 启动；支持 `--browser-executable` / `YCLAW_BROWSER_EXECUTABLE` 指向系统浏览器                                                                                                   | 浏览器自动发现、RunnerHost、复杂真实站点验收和更完整运行时治理仍待补齐               |
| `docs/specs/remote-runner-control-plane-v1.md`        | P0 基础版已落地                    | 已具备 Runner 连接管理、能力探测、执行下发、状态查询、实时日志、取消执行、健康检查与最小 daemon 联调链路                                                                                                                                                                                                                                                         | 会话治理、结果聚合、失败恢复策略与映射关系仍待继续收口                               |
| `docs/specs/capacity-aware-runner-scheduler-v1.md`    | P0/P1 基础版已落地                 | 已具备本地/远程统一 Runner 池、分队列加权轮询、容量评分、dispatch、lease、orphan reconcile、自动化页 `RunnerSchedulerPanel` 与最小运维操作                                                                                                                                                                                                                       | 策略配置化、更细粒度可观测、更多异常策略与长时间稳定性验收仍待补齐                   |
| `docs/design/ai-assistant.md`                         | 部分落地                           | 已有 `AIService`、`ToolRegistry`、聊天面板、MCP 工具接入                                                                                                                                                                                                                                                                                                         | 流式输出、更多 provider 体验与更深层任务助理能力仍待扩展                             |
| `docs/design/dashboard-ideas.md`                      | 未开始                             | 当前没有按该文档独立推进总控仪表盘重构                                                                                                                                                                                                                                                                                                                           | 属于中后期体验增强方向                                                               |
| `docs/design/page-container-optimization.md`          | 未系统推进                         | 局部页面样式已有演进，但未按文档做专项改造                                                                                                                                                                                                                                                                                                                       | 仍属于设计建议                                                                       |
| `docs/design/package-size-optimization.md`            | 部分处理                           | 仓库中已有相关 review / remediation 记录                                                                                                                                                                                                                                                                                                                         | 尚未形成持续化、指标化的专项实施线                                                   |
| `docs/architecture/dev-runtime.md`                    | 已新增                             | 解释 `npm run dev`、端口变化、Electron 启动条件与运行时检查                                                                                                                                                                                                                                                                                                      | 用于回答“浏览器打不开但 Electron 正常”这类问题                                       |
| `docs/architecture/feature-pack-plugin-governance.md` | 已新增                             | 解释功能包 manifest、安装落点、模块打开策略、插件权限和本地安装边界                                                                                                                                                                                                                                                                                              | 用于回答“功能包和插件现在到底怎么分发”                                               |
| `docs/overview/implementation-audit.md`               | 已新增                             | 对照真实代码、测试与脚本标注文档齐全度与已做 / 未做                                                                                                                                                                                                                                                                                                              | 用于回答“实现有没有文档承接”                                                         |

### 2.3 docs 中尚未启动或仅停留在设计层的方向

| 文档 / 方向                                                               | 当前状态                 | 备注                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `docs/design/dashboard-ideas.md`                                          | 未开始                   | 总控仪表盘重构尚未立项实现                                                                                                  |
| `docs/design/next-phase-ideas.md` 的 D · 数据出口/可观测性                | 已拆为独立主线并进入实现 | 当前主线收口至 `docs/specs/data-center-v1.md` 与 `docs/plans/data-center-v1.md`                                             |
| `docs/design/next-phase-ideas.md` 的 E · Snapshot Replay                  | 仅设计探索               | 尚未拆独立 spec，也未开始代码实现                                                                                           |
| `docs/design/next-phase-ideas.md` 的 F · 本地 LLM Provider                | 仅设计探索               | 建议后续并入 `docs/specs/v1.1-enhancements.md` 增量                                                                         |
| `docs/specs/headless-runner-v1.md` 的浏览器自动发现/分发策略 / RunnerHost | 部分未开始               | CLI `run/list/daemon`、基础 Playwright adapter 与最小 remote daemon 已落地；自动发现、RunnerHost 和复杂调度策略仍未进入实现 |

> 阅读建议：`specs/` 更关注“目标与验收”，本表回答的是“代码现在已经做到多少”。

---

## 3. 已落地能力

### 3.1 主进程与系统服务

| 能力               | 当前实现                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 应用启动与生命周期 | `src/main/index.ts`、`src/main/app.ts`                                                                               |
| 窗口管理           | `WindowManager`，支持模块窗口管理                                                                                    |
| 浏览器标签管理     | `TabManager` 管理 WebContentsView 标签页                                                                             |
| IPC 控制器         | `IpcController` + `EventBus`                                                                                         |
| 配置服务           | `ConfigService`                                                                                                      |
| 数据库服务         | `DatabaseService`（SQLite / `better-sqlite3`）                                                                       |
| 日志服务           | `LogService`                                                                                                         |
| 远程执行控制面     | `RemoteRunnerService` + `remote-runner-handlers.ts`                                                                  |
| Runner 调度服务    | `RunnerRegistryService`、`DispatchQueueService`、`RunnerDispatchService`、`ExecutionLeaseService`、`LeaseReconciler` |
| 托盘与更新         | `TrayService`、`UpdateService`                                                                                       |

### 3.2 渲染端模块

| 模块            | 当前实现                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workbench`     | 工作台首页、设置页、命令面板、AI 面板入口                                                                                                                                           |
| `stock`         | K 线图、技术指标展示基础能力                                                                                                                                                        |
| `automation`    | 任务列表、步骤编辑、执行面板、批次/结果/模板管理，以及 `RemoteRunnerPanel`、`RunnerSchedulerPanel`；并已新增京东签到任务面板、签到状态卡与专项 IPC 链路                             |
| `data-center`   | 数据总览、结果资产、导出任务、状态筛选与取消、导出创建弹窗、数据集、Webhook 目标、API Token、本地只读 API、Webhook 出口底层能力、数据质量一键扫描、质量规则启停、结果评分、批次洞察 |
| `browser`       | 地址栏、标签栏、干预面板、录制面板、抖音分析台、`HOT` 采集工作台、容器视图                                                                                                          |
| `plugin-center` | 插件列表、权限展示、安装/启停/卸载操作                                                                                                                                              |
| `plugin-host`   | 受限宿主环境与桥接层                                                                                                                                                                |

### 3.3 引擎与业务能力

| 能力域                   | 当前实现                                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 自动化引擎               | `AutomationEngine`、`FlowRunner`、`RetryPolicy`、`SelectorGenerator`                                                                                                                                                                               |
| 分析引擎                 | `DataSourceManager`、`IndicatorLibrary`                                                                                                                                                                                                            |
| AI 服务层                | `AIService`、`ContextManager`、`ToolRegistry`、`LLMProvider`                                                                                                                                                                                       |
| Task-as-Code             | YAML 序列化、CLI lint/import/export、IPC/preload/API、目录监听、Repository Persistence                                                                                                                                                             |
| MCP 集成                 | MCP Server/Client、stdio/http transport、工具注册、dangerous 确认、审计与示例配置                                                                                                                                                                  |
| Headless Runner / Daemon | CLI `run/list/daemon`、Playwright 页面适配、`RemoteRunnerServer` 最小运行时                                                                                                                                                                        |
| Remote Runner 控制面     | 连接管理、能力探测、执行下发、实时日志、取消执行、健康检查                                                                                                                                                                                         |
| Runner 调度底座          | 本地/远程统一 Runner 池、队列、容量评分、lease、orphan reconcile                                                                                                                                                                                   |
| 自动化运营闭环           | 批次、结果、告警、会话、模板、执行日志、远程 Runner 与调度池基础链路                                                                                                                                                                               |
| 数据出口中心             | 结果资产聚合、持久化导出、状态筛选、取消与重试、手动导出创建、数据集沉淀、Webhook 目标管理与测试、API Token 生成/模板/吊销、本地只读 API、Webhook 投递、token 校验底层雏形、数据质量扫描、规则启停、结果评分、批次洞察与 findings / insight 持久化 |

### 3.4 工程能力

| 能力           | 当前实现                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------- |
| 开发启动       | `npm run dev`                                                                                |
| 开发运行时校验 | `predev` + `scripts/ensure-dev-runtime.cjs`                                                  |
| 构建           | `npm run build`、`npm run build:core`、`npm run build:features`、`npm run build:main`        |
| 质量检查       | `npm run lint`、`npm run typecheck`                                                          |
| 测试           | `npm test`、`npm run test:coverage`、`npm run test:e2e`                                      |
| 打包           | `npm run pack`、`npm run dist`、`npm run dist:mac`、`npm run dist:win`、`npm run dist:linux` |
| 单实例治理     | `src/main/bootstrap.ts` + `src/main/single-instance.ts`                                      |

---

## 4. 当前代码结构重点

| 路径                        | 说明                                                |
| --------------------------- | --------------------------------------------------- |
| `src/main/`                 | Electron 主进程、系统服务、AI、插件、浏览器管理     |
| `src/cli/`                  | `yclaw` CLI 与 Task-as-Code / runner / MCP 命令入口 |
| `src/mcp/`                  | MCP Server / Client 与共享协议适配层                |
| `src/renderer/entries/`     | 业务模块入口页                                      |
| `src/renderer/plugin-host/` | 插件宿主页与桥接层                                  |
| `src/renderer/shared/`      | 跨模块共享组件、Hook、样式、工具                    |
| `src/shared/`               | 主/渲染进程共享类型、常量、工具                     |
| `src/runner/`               | Headless Runner CLI、daemon、Playwright 运行时适配  |
| `src/engines/`              | 自动化与分析引擎                                    |
| `tests/integration/`        | MCP / IPC 集成测试                                  |
| `tests/unit/`               | 单元与回归测试                                      |
| `tests/e2e/`                | Playwright 端到端测试                               |
| `scripts/`                  | 开发、构建、特性包同步、打包辅助脚本                |

---

## 5. 当前实现与早期规划的关系

| 项目        | 当前情况                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| 文档基调    | 早期 `docs/product/prd.md`、`docs/product/plan.md`、`docs/specs/v1.0-baseline.md` 偏规划；当前仓库已进入实现阶段 |
| 多入口模型  | 已实现业务模块入口；当前还增加了 `plugin-host` 和 feature pack 构建链路                                          |
| 插件系统    | 已落地基础权限模型与宿主容器；更强隔离仍属后续演进                                                               |
| 自动化能力  | 已具备基础执行、结果、干预、模板、远程执行控制面与容量感知调度底座；真实复杂页面场景仍在增强                     |
| Runner 形态 | 已从单机任务执行扩展到本地 CLI、最小 daemon、远程 Runner 控制面和统一调度池                                      |
| AI 助手     | 已实现基础服务层与面板；流式输出、更多工具仍在后续规划中                                                         |

---

## 6. 已知限制

| 类别        | 当前限制                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| 自动化执行  | 更偏“基础生产化骨架”，复杂真实页面适配仍需继续增强                                                                       |
| 自动签到    | 当前只保留京东签到能力；SMTP 客户端已接入，状态卡可显示最近运行历史；真实 SMTP 服务验收、历史记录分页/筛选等增强仍未完成 |
| 调度策略    | 当前队列权重、lease 参数、`unknown` 幂等性处理仍偏保守，配置化程度有限                                                   |
| 远程 Runner | 控制面和 daemon 已可联调，但会话治理、结果汇总、长连稳定性仍属下一阶段                                                   |
| 插件隔离    | 目前仍是 V1 基础模式，尚未达到按插件独立进程隔离                                                                         |
| e2e 范围    | Playwright 主要覆盖浏览器/自动化运营链路，尚未完全覆盖打包后的 Electron 成品                                             |
| 打包验证    | 已有打包脚本，但各平台发行质量仍需持续验证                                                                               |
| 文档演进    | 仓库中同时保留了规划文档、专项方案文档与实现文档，阅读时需注意区分“目标”和“现状”                                         |

---

## 7. 建议阅读顺序

| 目标         | 建议顺序                                                                |
| ------------ | ----------------------------------------------------------------------- |
| 快速了解项目 | `README.md` → `docs/overview/current-status.md`                         |
| 了解技术架构 | `docs/overview/current-status.md` → `docs/architecture/architecture.md` |
| 快速定位代码 | `docs/architecture/structure.md`                                        |
| 了解产品愿景 | `docs/product/prd.md`                                                   |
| 了解基线规格 | `docs/specs/v1.0-baseline.md`、`docs/specs/v1.1-enhancements.md`        |
| 了解专项演进 | `docs/specs/automation-browser-ops-v1.md`、`docs/overview/roadmap.md`   |
