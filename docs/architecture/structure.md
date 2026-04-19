# 📁 YClaw 项目文件结构

> 本文档以**当前仓库真实结构**为准，重点帮助快速定位代码。
> 若要了解系统如何运行，请阅读 `docs/architecture/architecture.md`；若要了解当前实现范围，请阅读 `docs/overview/current-status.md`。

## 目录总览

```text
yclaw/
├── docs/                          项目文档、专项方案、路线与评审记录
├── src/
│   ├── main/                      Electron 主进程、系统服务、AI、插件、浏览器管理
│   ├── renderer/
│   │   ├── entries/               业务模块入口
│   │   ├── plugin-host/           插件宿主页与受限桥接
│   │   └── shared/                渲染层共享组件、Hook、样式、工具
│   ├── shared/                    主/渲染进程共享类型、常量、工具
│   └── engines/                   自动化引擎与分析引擎
├── plugins/                       插件模板与插件目录
├── scripts/                       开发、构建、同步、打包辅助脚本
├── tests/
│   ├── unit/                      单元测试、回归测试、配置/脚本测试
│   ├── e2e/                       Playwright 端到端测试
│   └── setup-component.ts         组件测试初始化
├── .github/                       CI、发版、Issue/PR 模板
├── package.json                   工程脚本与依赖定义
└── README.md                      仓库首页
```

---

## 关键目录职责详解

### `docs/` — 文档体系

| 路径 | 说明 |
| --- | --- |
| `docs/overview/current-status.md` | 当前实现状态、限制与阅读建议 |
| `docs/product/prd.md` | 产品愿景与用户场景 |
| `docs/product/plan.md` | 可行性分析与阶段计划 |
| `docs/architecture/architecture.md` | 技术架构、进程模型、调用链路 |
| `docs/architecture/structure.md` | 当前目录结构与职责说明 |
| `docs/specs/v1.0-baseline.md` | 基线规格与验收标准 |
| `docs/specs/v1.1-enhancements.md` | 增强项规格 |
| `docs/specs/automation-browser-ops-v1.md` | 自动化 Browser Ops 专项规格 |
| `docs/overview/roadmap.md` | 近期演进方向 |
| 其他中文方案/评审文档 | 历史设计、代码审查、专项记录，作为背景材料保留 |

### `src/main/` — Electron 主进程

| 目录/文件 | 职责 |
| --- | --- |
| `src/main/index.ts` | 主进程入口，负责启动与异常兜底 |
| `src/main/app.ts` | 应用生命周期编排 |
| `src/main/windows/` | 窗口管理与 preload 入口 |
| `src/main/ipc/` | IPC 通道路由、事件总线、消息边界控制 |
| `src/main/browser/` | WebContentsView 标签与会话管理 |
| `src/main/plugin-loader/` | 插件扫描、加载、权限校验 |
| `src/main/ai/` | AI 服务层、工具注册、上下文收集、Provider 抽象 |
| `src/main/services/` | 配置、数据库、日志、调度、批次、结果、模板、告警等系统服务 |
| `src/main/services/repositories/` | 数据仓储层，承接具体表与持久化读写 |
| `src/main/utils/` | 路径等主进程辅助工具 |

### `src/renderer/entries/` — 业务模块入口

当前有 **5 个业务入口**：

| 入口 | 说明 |
| --- | --- |
| `workbench/` | 主工作台、模块导航、设置、AI 与命令面板入口 |
| `stock/` | 股票分析与技术指标展示 |
| `automation/` | 自动化任务、批次、结果、模板管理 |
| `browser/` | 浏览器会话控制台、干预面板、录制面板 |
| `plugin-center/` | 插件安装、启停、卸载、权限确认 |

### `src/renderer/plugin-host/` — 插件宿主页

| 路径 | 说明 |
| --- | --- |
| `index.html` | 插件宿主入口页 |
| `PluginBridge.ts` | 宿主与插件间桥接逻辑 |
| `preload.ts` | 受限预加载 API |

> `plugin-host` 不属于普通业务入口，但属于渲染层的重要一环。

### `src/renderer/shared/` — 渲染层共享

| 目录 | 说明 |
| --- | --- |
| `createEntry.tsx` | 多入口统一挂载入口 |
| `components/` | PageShell、TitleBar、GlobalLoading、AIChatPanel、CommandPalette、Sparkline、RingGauge、TaskTimeline 等 |
| `hooks/` | `useIpc`、`useEventBus`、`useLoading` |
| `styles/` | 全局样式与主题配置 |
| `utils/` | 渲染层格式化与通用工具 |

### `src/shared/` — 跨进程共享

| 目录 | 说明 |
| --- | --- |
| `types/` | IPC、AI、插件、浏览器、股票、任务、配置、特性包等类型定义 |
| `constants/` | IPC 通道、事件、权限常量 |
| `utils/` | 校验、日志等共享工具 |

### `src/engines/` — 核心引擎

| 目录 | 说明 |
| --- | --- |
| `src/engines/automation/` | 自动化引擎、流程执行、重试策略、选择器生成 |
| `src/engines/analytics/` | 数据源管理与指标计算 |

### `plugins/` — 插件目录

| 路径 | 说明 |
| --- | --- |
| `plugins/_template/` | 插件模板，包含 `plugin.json`、`package.json`、`README.md`、`src/index.ts` |

### `scripts/` — 工程脚本

| 文件 | 说明 |
| --- | --- |
| `scripts/dev.ts` | 开发环境启动 |
| `scripts/build-feature-pack.ts` | 构建单个特性包 |
| `scripts/sync-feature-packs.ts` | 同步特性包产物 |
| `scripts/dist-win-core.ts` | Windows 核心包构建 |
| `scripts/dist-win-core-utils.ts` | Windows 打包辅助逻辑 |
| `scripts/after-pack-prune.cjs` | 打包后裁剪辅助 |
| `scripts/spawn-utils.ts` | 子进程工具函数 |

### `tests/` — 测试结构

| 路径 | 说明 |
| --- | --- |
| `tests/unit/components/` | 组件测试与前端回归测试 |
| `tests/unit/services/` | 服务层、IPC、AI、插件、窗口与浏览器管理测试 |
| `tests/unit/services/repositories/` | 仓储层测试 |
| `tests/unit/engines/` | 自动化/分析引擎测试 |
| `tests/unit/shared/` | 共享常量、格式化、校验工具测试 |
| `tests/unit/config/` | 构建与测试配置测试 |
| `tests/unit/scripts/` | 脚本工具测试 |
| `tests/unit/plugin-host/` | 插件宿主桥接测试 |
| `tests/e2e/` | Playwright 端到端测试 |

---

## 实际结构与早期规划的差异

| 项目 | 当前情况 |
| --- | --- |
| 文档背景 | 仓库最初以规划文档起步，现已演进为真实工程仓库 |
| 渲染入口数量 | 当前是 5 个业务入口 + 1 个 `plugin-host` 宿主 |
| 服务层 | 已新增批次、结果、模板、告警、调度、特性包等服务，不止基础系统服务 |
| 数据访问层 | 当前采用 `services/` + `repositories/` 分层，而不是单一服务文件结构 |
| 测试结构 | 已扩展为组件、服务、仓储、引擎、脚本、e2e 多层测试 |

---

## 新增模块扩展建议

若要新增一个业务模块（例如 `pdf-tools`），建议按以下步骤：

| 步骤 | 操作 |
| --- | --- |
| 1 | 在 `src/renderer/entries/` 下创建模块目录 |
| 2 | 添加 `index.html`、`main.tsx`、`App.tsx` |
| 3 | 在 `vite.config.ts` 注册入口 |
| 4 | 在工作台导航中增加模块入口 |
| 5 | 在窗口管理与路径解析中补齐模块配置 |
| 6 | 为该模块补充最基础的单元测试与文档说明 |

保持模块边界清晰，跨模块通信统一走主进程 IPC / EventBus。
