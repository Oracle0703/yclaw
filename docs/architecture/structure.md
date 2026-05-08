# 📁 YClaw 项目文件结构

> 本文档以**当前仓库真实结构**为准，重点帮助快速定位代码。
> 若要了解系统如何运行，请阅读 `docs/architecture/architecture.md`；若要了解当前实现范围，请阅读 `docs/overview/current-status.md`。

## 目录总览

```text
yclaw/
├── docs/                          项目文档、专项方案、路线与评审记录
├── src/
│   ├── cli/                       `npm run yclaw -- ...` 命令入口与子命令
│   ├── main/                      Electron 主进程、系统服务、AI、插件、浏览器管理
│   ├── mcp/                       MCP server/client、共享 schema 与资源协议
│   ├── renderer/
│   │   ├── entries/               业务模块入口
│   │   ├── plugin-host/           插件宿主页与受限桥接
│   │   └── shared/                渲染层共享组件、Hook、样式、工具
│   ├── shared/                    主/渲染进程共享类型、常量、工具
│   ├── runner/                    Headless Runner CLI、daemon、浏览器运行时适配
│   └── engines/                   自动化引擎与分析引擎
├── plugins/                       插件模板与插件目录
├── scripts/                       开发、构建、同步、打包辅助脚本
├── tests/
│   ├── unit/                      单元测试、回归测试、配置/脚本测试
│   ├── integration/               集成测试（当前主要覆盖 MCP / IPC）
│   ├── e2e/                       Playwright 端到端测试
│   ├── fixtures/                  测试夹具与 mock server
│   └── setup-component.ts         组件测试初始化
├── .github/                       CI、发版、Issue/PR 模板
├── package.json                   工程脚本与依赖定义
└── README.md                      仓库首页
```

---

## 关键目录职责详解

### `docs/` — 文档体系

| 路径                                      | 说明                                           |
| ----------------------------------------- | ---------------------------------------------- |
| `docs/overview/current-status.md`         | 当前实现状态、限制与阅读建议                   |
| `docs/product/prd.md`                     | 产品愿景与用户场景                             |
| `docs/product/plan.md`                    | 可行性分析与阶段计划                           |
| `docs/architecture/architecture.md`       | 技术架构、进程模型、调用链路                   |
| `docs/architecture/structure.md`          | 当前目录结构与职责说明                         |
| `docs/specs/v1.0-baseline.md`             | 基线规格与验收标准                             |
| `docs/specs/v1.1-enhancements.md`         | 增强项规格                                     |
| `docs/specs/automation-browser-ops-v1.md` | 自动化 Browser Ops 专项规格                    |
| `docs/overview/roadmap.md`                | 近期演进方向                                   |
| 其他中文方案/评审文档                     | 历史设计、代码审查、专项记录，作为背景材料保留 |

### `src/main/` — Electron 主进程

| 目录/文件                             | 职责                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main/index.ts`                   | 主进程入口，负责启动与异常兜底                                                                                                                                                             |
| `src/main/app.ts`                     | 应用生命周期编排                                                                                                                                                                           |
| `src/main/bootstrap.ts`               | 主进程启动编排，统一处理单实例、ready、activate、quit 生命周期                                                                                                                             |
| `src/main/single-instance.ts`         | 单实例抢锁与二开实例回到主窗口逻辑                                                                                                                                                         |
| `src/main/windows/`                   | 窗口管理与 preload 入口                                                                                                                                                                    |
| `src/main/ipc/`                       | IPC 通道路由、事件总线、消息边界控制；包含 `remote-runner-handlers.ts`、`runner-scheduler-handlers.ts`、`hot-handlers.ts`、`comment-handlers.ts`、`data-center-handlers.ts` 等专项 handler |
| `src/main/browser/`                   | WebContentsView 标签与会话管理                                                                                                                                                             |
| `src/main/plugin-loader/`             | 插件扫描、加载、权限校验                                                                                                                                                                   |
| `src/main/ai/`                        | AI 服务层、工具注册、上下文收集、Provider 抽象                                                                                                                                             |
| `src/main/services/`                  | 配置、数据库、日志、调度、批次、结果、模板、告警、Remote Runner 等系统服务；并按子域继续拆分                                                                                               |
| `src/main/services/data-center/`      | 导出任务、Webhook、API Token、本地只读 API、数据质量与洞察                                                                                                                                 |
| `src/main/services/hot/`              | `HOT` 源管理、运行投影、报告生成、任务编译                                                                                                                                                 |
| `src/main/services/comment/`          | 评论源管理、运行投影、报告生成、AI 回复、MediaCrawler 外部执行器与结果导入                                                                                                                 |
| `src/main/services/repositories/`     | 数据仓储层，承接具体表与持久化读写                                                                                                                                                         |
| `src/main/services/runner-scheduler/` | 容量评分、Runner 注册、队列、dispatch、lease、reconcile 等调度子模块                                                                                                                       |
| `src/main/services/task-as-code/`     | YAML Persistence、watch bootstrap 与仓库同步                                                                                                                                               |
| `src/main/utils/`                     | 路径等主进程辅助工具                                                                                                                                                                       |

### `src/renderer/entries/` — 业务模块入口

当前有 **8 个业务入口**：

| 入口               | 说明                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `workbench/`       | 主工作台、模块导航、设置、AI 与命令面板入口                                            |
| `stock/`           | 股票分析与技术指标展示                                                                 |
| `automation/`      | 自动化任务、批次、结果、模板管理，以及 Remote Runner / Runner 调度面板                 |
| `browser/`         | 浏览器会话控制台、干预面板、录制面板、抖音分析台、`HOT` 采集工作台                     |
| `data-center/`     | 结果资产、导出任务、Webhook / Token / 本地 API、质量与洞察                             |
| `plugin-center/`   | 插件安装、启停、卸载、权限确认                                                         |
| `hot-monitor/`     | 热点监控配置、运行与报告（在 workbench 内部以 `/hot-monitor` 路由懒加载）              |
| `comment-monitor/` | 评论监控配置、运行、AI 回复与报告（在 workbench 内部以 `/comment-monitor` 路由懒加载） |

### `src/renderer/plugin-host/` — 插件宿主页

| 路径              | 说明                 |
| ----------------- | -------------------- |
| `index.html`      | 插件宿主入口页       |
| `PluginBridge.ts` | 宿主与插件间桥接逻辑 |
| `preload.ts`      | 受限预加载 API       |

> `plugin-host` 不属于普通业务入口，但属于渲染层的重要一环。

### `src/renderer/shared/` — 渲染层共享

| 目录              | 说明                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `createEntry.tsx` | 多入口统一挂载入口                                                                                     |
| `components/`     | PageShell、TitleBar、GlobalLoading、AIChatPanel、CommandPalette、Sparkline、RingGauge、TaskTimeline 等 |
| `hooks/`          | `useIpc`、`useEventBus`、`useLoading`                                                                  |
| `styles/`         | 全局样式与主题配置                                                                                     |
| `utils/`          | 渲染层格式化与通用工具                                                                                 |
| `api/`            | 主进程 IPC 的前端封装，例如 `runnerScheduler.ts`、`dataCenter.ts`、`taskAsCode.ts`                     |

### `src/shared/` — 跨进程共享

| 目录             | 说明                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `types/`         | IPC、AI、插件、浏览器、股票、任务、`HOT`、`Comment`、Data Center、Remote Runner、Runner Scheduler、配置、特性包等类型定义 |
| `constants/`     | IPC 通道、事件、权限常量、Task-as-Code 常量与 Runner 调度默认值                                                           |
| `serialization/` | Task-as-Code YAML schema、loader、watcher、mapping、migrate、secrets                                                      |
| `utils/`         | 校验、日志等共享工具                                                                                                      |

### `src/cli/` — 桌面外命令入口

| 路径                                 | 说明                           |
| ------------------------------------ | ------------------------------ |
| `src/cli/yclaw.ts`                   | CLI 主入口                     |
| `src/cli/lint.ts`                    | Task-as-Code lint / SARIF 输出 |
| `src/cli/io.ts` `src/cli/fs-walk.ts` | CLI 文件 IO 与目录遍历辅助     |

### `src/mcp/` — MCP 集成

| 路径              | 说明                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `src/mcp/server/` | 桌面内嵌 / CLI MCP server、stdio / HTTP transport、capability 注册 |
| `src/mcp/client/` | 外部 MCP server 连接与 tool 注册                                   |
| `src/mcp/shared/` | schema、资源 URI、协议共享类型                                     |

### `src/runner/` — Headless Runner 与 daemon

| 路径                  | 说明                                                  |
| --------------------- | ----------------------------------------------------- |
| `src/runner/cli/`     | `run`、`list`、`daemon` 等命令入口                    |
| `src/runner/browser/` | Playwright 页面适配，如 `PlaywrightAutomationPage.ts` |
| `src/runner/daemon/`  | 最小 Remote Runner HTTP/SSE server 与内存 runtime     |

### `src/engines/` — 核心引擎

| 目录                      | 说明                                       |
| ------------------------- | ------------------------------------------ |
| `src/engines/automation/` | 自动化引擎、流程执行、重试策略、选择器生成 |
| `src/engines/analytics/`  | 数据源管理与指标计算                       |

### `plugins/` — 插件目录

| 路径                 | 说明                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| `plugins/_template/` | 插件模板，包含 `plugin.json`、`package.json`、`README.md`、`src/index.ts` |

### `scripts/` — 工程脚本

| 文件                                  | 说明                            |
| ------------------------------------- | ------------------------------- |
| `scripts/dev.ts`                      | 开发环境启动                    |
| `scripts/dev-log-filter.ts`           | Electron dev stderr 过滤与聚合  |
| `scripts/ensure-dev-runtime.cjs`      | `predev` 运行时环境检查         |
| `scripts/ensure-dev-runtime-utils.js` | 开发环境探测辅助                |
| `scripts/ensure-node-native-deps.cjs` | 测试前原生依赖检查              |
| `scripts/build-feature-pack.ts`       | 构建单个特性包                  |
| `scripts/sync-feature-packs.ts`       | 同步特性包产物                  |
| `scripts/dist-win-core.ts`            | Windows 核心包构建              |
| `scripts/dist-win-core-utils.ts`      | Windows 打包辅助逻辑            |
| `scripts/after-pack-prune.cjs`        | 打包后裁剪辅助                  |
| `scripts/spawn-utils.ts`              | 子进程工具函数                  |
| `scripts/yclaw.ts`                    | `npm run yclaw -- ...` 脚本入口 |

### `tests/` — 测试结构

| 路径                                    | 说明                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| `tests/unit/cli/`                       | CLI 命令与安全边界测试                                   |
| `tests/unit/components/`                | 组件测试与前端回归测试                                   |
| `tests/unit/services/`                  | 服务层、IPC、AI、插件、窗口与浏览器管理测试              |
| `tests/unit/services/data-center/`      | Data Center 相关服务测试                                 |
| `tests/unit/services/repositories/`     | 仓储层测试                                               |
| `tests/unit/services/runner-scheduler/` | Runner 调度子模块测试                                    |
| `tests/unit/services/task-as-code/`     | Task-as-Code 主进程集成测试                              |
| `tests/unit/engines/`                   | 自动化/分析引擎测试                                      |
| `tests/unit/ipc/`                       | IPC handler 测试，包括 remote runner 与 runner scheduler |
| `tests/unit/renderer/`                  | 渲染层 API、Data Center、浏览器抖音工作台测试            |
| `tests/unit/runner/`                    | CLI、daemon、Playwright 页面适配测试                     |
| `tests/unit/serialization/`             | YAML、watcher、schema、migrate、安全测试                 |
| `tests/unit/shared/`                    | 共享常量、格式化、校验工具测试                           |
| `tests/unit/config/`                    | 构建与测试配置测试                                       |
| `tests/unit/scripts/`                   | 脚本工具测试                                             |
| `tests/unit/mcp/`                       | MCP 桌面宿主与示例测试                                   |
| `tests/unit/plugin-host/`               | 插件宿主桥接测试                                         |
| `tests/integration/`                    | MCP / IPC 集成测试                                       |
| `tests/fixtures/`                       | mock stdio server 等夹具                                 |
| `tests/e2e/`                            | Playwright 端到端测试                                    |

---

## 实际结构与早期规划的差异

| 项目         | 当前情况                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------- |
| 文档背景     | 仓库最初以规划文档起步，现已演进为真实工程仓库                                                |
| 渲染入口数量 | 当前是 6 个业务入口 + 1 个 `plugin-host` 宿主                                                 |
| 服务层       | 已新增批次、结果、模板、告警、Remote Runner、Runner Scheduler、特性包等服务，不止基础系统服务 |
| 数据访问层   | 当前采用 `services/` + `repositories/` 分层，而不是单一服务文件结构                           |
| 业务子域     | 已继续拆出 `data-center/`、`hot/`、`task-as-code/` 等明确子域                                 |
| CLI / MCP    | 当前已包含 `src/cli/` 与 `src/mcp/`，不再只服务 Electron 窗口内场景                           |
| Runner 形态  | 已包含 `src/runner/cli` 与 `src/runner/daemon`，不再只有 Electron 内部执行路径                |
| 测试结构     | 已扩展为组件、服务、仓储、IPC、runner、脚本、e2e 多层测试                                     |

---

## 新增模块扩展建议

若要新增一个业务模块（例如 `pdf-tools`），建议按以下步骤：

| 步骤 | 操作                                      |
| ---- | ----------------------------------------- |
| 1    | 在 `src/renderer/entries/` 下创建模块目录 |
| 2    | 添加 `index.html`、`main.tsx`、`App.tsx`  |
| 3    | 在 `vite.config.ts` 注册入口              |
| 4    | 在工作台导航中增加模块入口                |
| 5    | 在窗口管理与路径解析中补齐模块配置        |
| 6    | 为该模块补充最基础的单元测试与文档说明    |

保持模块边界清晰，跨模块通信统一走主进程 IPC / EventBus。
