# 📌 YClaw 当前实现现状

> 本文档描述仓库**当前已经落地的实现**、工程运行方式、已知限制与后续重点。  
> 若需查看产品愿景与长期规划，请阅读 `docs/prd.md`、`docs/plan.md`、`docs/specs.md`。

---

## 1. 文档定位

| 文档 | 作用 | 适用场景 |
| --- | --- | --- |
| `docs/current-status.md` | 当前代码实现与工程状态 | 想知道“现在做到哪了” |
| `docs/index.md` | `docs/` 文档总索引 | 想知道“还有哪些资料” |
| `docs/architecture.md` | 技术分层、调用链路、进程模型 | 想了解“系统怎么工作” |
| `docs/structure.md` | 实际目录结构与模块职责 | 想快速定位代码 |
| `docs/prd.md` | 产品愿景、角色、场景 | 想了解“为什么做这个项目” |
| `docs/plan.md` | 可行性分析与阶段路线 | 想了解“整体怎么推进” |
| `docs/specs.md` | 基线规格与验收目标 | 想了解“V1.0 要交付什么” |
| `docs/specs-enhancements.md` | 增强项规格 | 想了解“V1.1 之后补什么” |

---

## 2. 当前状态总览

| 维度 | 当前状态 | 说明 |
| --- | --- | --- |
| 项目形态 | 已进入可运行开发阶段 | 不再是纯规划仓库，已包含完整 `package.json`、`src/`、`tests/` |
| 桌面壳 | 已实现 | Electron 主进程、窗口管理、托盘、更新服务已落地 |
| 渲染层 | 已实现 | React + Vite 多入口结构已建立 |
| IPC 边界 | 已实现 | 主进程 / preload / 渲染进程之间已有类型化 IPC 通道 |
| 核心引擎 | 已实现基础能力 | 自动化引擎、分析引擎已具备基础执行与测试覆盖 |
| AI 助手 | 已实现基础版本 | 包含服务层、工具注册、聊天面板 |
| 插件体系 | 已实现基础版本 | 已有插件加载、权限校验、插件中心、插件宿主 |
| 测试体系 | 已建立 | 包含 Vitest 单测、回归测试、Playwright e2e |
| 打包能力 | 已建立 | 支持 `build`、`pack`、`dist` 与多平台打包脚本 |

---

## 3. 已落地能力

### 3.1 主进程与系统服务

| 能力 | 当前实现 |
| --- | --- |
| 应用启动与生命周期 | `src/main/index.ts`、`src/main/app.ts` |
| 窗口管理 | `WindowManager`，支持模块窗口管理 |
| 浏览器标签管理 | `TabManager` 管理 WebContentsView 标签页 |
| IPC 控制器 | `IpcController` + `EventBus` |
| 配置服务 | `ConfigService` |
| 数据库服务 | `DatabaseService`（SQLite / `better-sqlite3`） |
| 日志服务 | `LogService` |
| 托盘与更新 | `TrayService`、`UpdateService` |

### 3.2 渲染端模块

| 模块 | 当前实现 |
| --- | --- |
| `workbench` | 工作台首页、设置页、命令面板、AI 面板入口 |
| `stock` | K 线图、技术指标展示基础能力 |
| `automation` | 任务列表、步骤编辑、执行面板、批次/结果/模板管理 |
| `browser` | 地址栏、标签栏、干预面板、录制面板、容器视图 |
| `plugin-center` | 插件列表、权限展示、安装/启停/卸载操作 |
| `plugin-host` | 受限宿主环境与桥接层 |

### 3.3 引擎与业务能力

| 能力域 | 当前实现 |
| --- | --- |
| 自动化引擎 | `AutomationEngine`、`FlowRunner`、`RetryPolicy`、`SelectorGenerator` |
| 分析引擎 | `DataSourceManager`、`IndicatorLibrary` |
| AI 服务层 | `AIService`、`ContextManager`、`ToolRegistry`、`LLMProvider` |
| 自动化运营闭环 | 批次、结果、告警、会话、模板、执行日志、调度骨架 |

### 3.4 工程能力

| 能力 | 当前实现 |
| --- | --- |
| 开发启动 | `npm run dev` |
| 构建 | `npm run build`、`npm run build:core`、`npm run build:features`、`npm run build:main` |
| 质量检查 | `npm run lint`、`npm run typecheck` |
| 测试 | `npm test`、`npm run test:coverage`、`npm run test:e2e` |
| 打包 | `npm run pack`、`npm run dist`、`npm run dist:mac`、`npm run dist:win`、`npm run dist:linux` |

---

## 4. 当前代码结构重点

| 路径 | 说明 |
| --- | --- |
| `src/main/` | Electron 主进程、系统服务、AI、插件、浏览器管理 |
| `src/renderer/entries/` | 业务模块入口页 |
| `src/renderer/plugin-host/` | 插件宿主页与桥接层 |
| `src/renderer/shared/` | 跨模块共享组件、Hook、样式、工具 |
| `src/shared/` | 主/渲染进程共享类型、常量、工具 |
| `src/engines/` | 自动化与分析引擎 |
| `tests/unit/` | 单元与回归测试 |
| `tests/e2e/` | Playwright 端到端测试 |
| `scripts/` | 开发、构建、特性包同步、打包辅助脚本 |

---

## 5. 当前实现与早期规划的关系

| 项目 | 当前情况 |
| --- | --- |
| 文档基调 | 早期 `docs/prd.md`、`docs/plan.md`、`docs/specs.md` 偏规划；当前仓库已进入实现阶段 |
| 多入口模型 | 已实现业务模块入口；当前还增加了 `plugin-host` 和 feature pack 构建链路 |
| 插件系统 | 已落地基础权限模型与宿主容器；更强隔离仍属后续演进 |
| 自动化能力 | 已具备基础执行、结果、干预、模板与调度骨架；真实复杂页面场景仍在增强 |
| AI 助手 | 已实现基础服务层与面板；流式输出、更多工具仍在后续规划中 |

---

## 6. 已知限制

| 类别 | 当前限制 |
| --- | --- |
| 自动化执行 | 更偏“基础生产化骨架”，复杂真实页面适配仍需继续增强 |
| 插件隔离 | 目前仍是 V1 基础模式，尚未达到按插件独立进程隔离 |
| e2e 范围 | Playwright 主要覆盖浏览器/自动化运营链路，尚未完全覆盖打包后的 Electron 成品 |
| 打包验证 | 已有打包脚本，但各平台发行质量仍需持续验证 |
| 文档演进 | 仓库中同时保留了规划文档、专项方案文档与实现文档，阅读时需注意区分“目标”和“现状” |

---

## 7. 建议阅读顺序

| 目标 | 建议顺序 |
| --- | --- |
| 快速了解项目 | `README.md` → `docs/current-status.md` |
| 了解技术架构 | `docs/current-status.md` → `docs/architecture.md` |
| 快速定位代码 | `docs/structure.md` |
| 了解产品愿景 | `docs/prd.md` |
| 了解基线规格 | `docs/specs.md`、`docs/specs-enhancements.md` |
| 了解专项演进 | `docs/specs-automation-browser-ops-v1.md`、`docs/roadmap-next.md` |
