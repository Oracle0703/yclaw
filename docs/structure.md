# 📁 YClaw 项目文件结构

> 多入口 + 插件框架 + AI 助手 | Electron + React + Vite

## 目录总览

```
yclaw/
├── docs/                          # 项目文档
│   ├── prd.md                     # 产品需求文档
│   ├── structure.md               # 本文件 — 项目结构
│   ├── architecture.md            # 技术架构图
│   ├── plan.md                    # 可行性分析 & 实施计划
│   ├── specs.md                   # V1.0 Spec 拆解（SPEC-001 ~ SPEC-022）
│   └── specs-enhancements.md      # V1.1 增强 Spec（SPEC-023 ~ SPEC-028）
│
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # 主进程入口（异常捕获 + 生命周期）
│   │   ├── app.ts                 # 应用生命周期管理（App 类）
│   │   ├── windows/               # 窗口管理
│   │   │   ├── WindowManager.ts   # 窗口创建 / 销毁 / 状态管理（上限 10 个）
│   │   │   ├── preload.ts         # 预加载脚本（contextBridge 安全暴露 API）
│   │   │   └── index.ts
│   │   ├── ipc/                   # IPC 通信层
│   │   │   ├── IpcController.ts   # IPC 路由注册与分发（含限流 100/s）
│   │   │   ├── channels.ts        # IPC 通道类型定义
│   │   │   ├── EventBus.ts        # 全局事件总线（单例 EventEmitter）
│   │   │   └── index.ts
│   │   ├── ai/                    # AI 服务层
│   │   │   ├── AIService.ts       # LLM 调度核心（对话管理 + 工具调用）
│   │   │   ├── ContextManager.ts  # 上下文收集（系统指标 + 模块状态）
│   │   │   ├── ToolRegistry.ts    # AI 工具注册 / 列表 / 执行
│   │   │   ├── LLMProvider.ts     # Provider 抽象层（OpenAI / Ollama）
│   │   │   ├── types.ts           # AI 模块内部类型
│   │   │   ├── index.ts
│   │   │   └── tools/             # 内置 AI 工具
│   │   │       ├── taskTools.ts   # task_list 工具
│   │   │       ├── systemTools.ts # system_status 工具
│   │   │       └── navigateTools.ts # navigate 模块导航工具
│   │   ├── plugin-loader/         # 插件加载器（主进程侧）
│   │   │   ├── PluginLoader.ts    # 插件扫描、校验、加载
│   │   │   ├── PermissionChecker.ts # 权限校验（三级权限模型）
│   │   │   └── index.ts
│   │   ├── browser/               # 浏览器标签管理
│   │   │   ├── TabManager.ts      # WebContentsView 标签页生命周期（上限 20）
│   │   │   └── index.ts
│   │   ├── services/              # 系统服务
│   │   │   ├── DatabaseService.ts # SQLite 服务（better-sqlite3, WAL 模式）
│   │   │   ├── ConfigService.ts   # 配置管理（JSON 持久化 + EventBus 广播）
│   │   │   ├── LogService.ts      # 日志服务（按日轮转, 7 天保留）
│   │   │   ├── TrayService.ts     # 系统托盘服务
│   │   │   ├── UpdateService.ts   # 自动更新服务（electron-updater）
│   │   │   └── index.ts
│   │   └── utils/                 # 主进程工具函数
│   │       └── paths.ts           # 应用路径管理 & 入口 URL 解析
│   │
│   ├── renderer/                  # 渲染进程（React + Vite 多入口）
│   │   ├── entries/               # 🔑 多入口根目录（每个子目录 = 独立 SPA）
│   │   │   ├── workbench/         # 主工作台（默认入口）
│   │   │   │   ├── index.html
│   │   │   │   ├── main.tsx
│   │   │   │   ├── App.tsx        # 集成 CommandPalette + AIChatPanel
│   │   │   │   ├── routes.tsx
│   │   │   │   ├── store/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── Home.tsx   # 首页（模块导航 + KPI 卡片）
│   │   │   │   │   └── Settings.tsx
│   │   │   │   └── styles/
│   │   │   │
│   │   │   ├── stock/             # 股票分析模块
│   │   │   │   ├── App.tsx
│   │   │   │   ├── components/
│   │   │   │   │   └── KLineChart.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── automation/        # 自动化采集模块
│   │   │   │   ├── App.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── TaskList.tsx
│   │   │   │   │   ├── StepEditor.tsx
│   │   │   │   │   └── ExecutionPanel.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── browser/           # 浏览器会话控制台
│   │   │   │   ├── App.tsx        # 标签页管理 + 会话信息展示 + IPC 常量调用
│   │   │   │   ├── components/
│   │   │   │   │   ├── TabBar.tsx
│   │   │   │   │   ├── AddressBar.tsx
│   │   │   │   │   └── WebViewContainer.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   └── plugin-center/     # 插件中心模块
│   │   │       ├── App.tsx
│   │   │       ├── components/
│   │   │       │   ├── PluginCard.tsx
│   │   │       │   └── PermissionDialog.tsx
│   │   │       └── ...
│   │   │
│   │   ├── shared/                # 渲染进程共享代码
│   │   │   ├── createEntry.tsx    # 入口工厂（React.createRoot）
│   │   │   ├── components/        # 通用 UI 组件
│   │   │   │   ├── PageShell.tsx         # 统一页面布局（标题 + 骨架屏 + 错误态）
│   │   │   │   ├── TitleBar.tsx          # 窗口控制栏（最小化 / 设置 / 关闭）
│   │   │   │   ├── ErrorBoundary.tsx     # React 错误边界
│   │   │   │   ├── GlobalLoading.tsx     # 全局 Loading（React Context + Spin）
│   │   │   │   ├── AdminPageLayout.tsx   # Ant Design Pro 布局
│   │   │   │   ├── AppProviders.tsx      # 全局 Provider（Antd 主题 + Loading）
│   │   │   │   ├── Sparkline.tsx         # KPI 趋势迷你图（纯 SVG）
│   │   │   │   ├── TaskTimeline.tsx      # 任务执行时间线（Antd Timeline）
│   │   │   │   ├── RingGauge.tsx         # 系统资源环形仪表盘（SVG）
│   │   │   │   ├── CommandPalette/       # 命令面板（Ctrl+K）
│   │   │   │   │   ├── CommandRegistry.ts  # 命令注册表（单例）
│   │   │   │   │   ├── CommandPalette.tsx  # 面板 UI + 模糊搜索
│   │   │   │   │   └── index.ts
│   │   │   │   └── AIChatPanel/          # AI 聊天面板（Ctrl+J）
│   │   │   │       ├── store.ts          # Zustand 对话状态
│   │   │   │       ├── AIChatPanel.tsx   # 悬浮气泡 + 展开面板
│   │   │   │       └── index.ts
│   │   │   ├── hooks/             # 通用 React Hooks
│   │   │   │   ├── useIpc.ts      # IPC 调用 + 事件监听
│   │   │   │   ├── useEventBus.ts # 全局事件订阅
│   │   │   │   ├── useLoading.ts  # 全局 Loading 控制
│   │   │   │   └── index.ts
│   │   │   ├── styles/
│   │   │   │   ├── globals.css
│   │   │   │   └── theme.ts
│   │   │   └── utils/
│   │   │       └── format.ts      # 数字 / 日期格式化
│   │   │
│   │   └── plugin-host/           # 插件宿主容器（V1.0 共享宿主页）
│   │       ├── index.html
│   │       ├── preload.ts         # 插件专用 preload（受限 API 集）
│   │       └── PluginBridge.ts    # 插件 API 桥接（storage / log / manifest）
│   │
│   ├── shared/                    # 跨进程共享代码（主进程 + 渲染进程）
│   │   ├── types/                 # TypeScript 类型定义
│   │   │   ├── index.ts           # 统一导出
│   │   │   ├── ipc.ts             # IpcResponse, WindowOpenParams, ElectronAPI
│   │   │   ├── plugin.ts          # PluginManifest, PluginStatus
│   │   │   ├── task.ts            # TaskFlow, TaskStep, TaskStatus
│   │   │   ├── stock.ts           # OHLCVData, DataSourceConfig, IndicatorType
│   │   │   ├── config.ts          # AppConfig, GeneralConfig, ModuleConfig
│   │   │   ├── browser.ts         # Tab 接口
│   │   │   └── ai.ts              # ChatMessage, AIConfig, AIToolDef, AIServiceContext
│   │   ├── constants/
│   │   │   ├── index.ts
│   │   │   ├── channels.ts        # IPC 通道名常量（60+ 通道）
│   │   │   ├── permissions.ts     # 三级权限常量
│   │   │   └── events.ts          # 全局事件名（20+）
│   │   └── utils/
│   │       ├── index.ts
│   │       ├── validator.ts       # Zod 校验（pluginManifest, taskFlow 等）
│   │       └── logger.ts          # 日志格式化工具
│   │
│   └── engines/                   # 核心引擎（主进程侧运行）
│       ├── automation/            # 自动化引擎
│       │   ├── AutomationEngine.ts    # 5 种操作：click / input / scroll / extract / screenshot
│       │   ├── FlowRunner.ts          # 任务流运行器（Flow → Step → Action + 断点续跑）
│       │   ├── SelectorGenerator.ts   # CSS 选择器生成
│       │   ├── RetryPolicy.ts         # 指数退避重试策略
│       │   ├── types.ts
│       │   └── index.ts
│       │
│       └── analytics/             # 数据分析引擎
│           ├── DataSourceManager.ts   # 数据源管理（REST / WebSocket）
│           ├── IndicatorLibrary.ts    # 技术指标库（MA / MACD / RSI / BOLL）
│           ├── types.ts
│           └── index.ts
│
├── plugins/                       # 📦 插件目录
│   ├── _template/                 # 插件开发模板
│   │   ├── plugin.json           # 插件元信息（名称 / 版本 / 权限声明）
│   │   ├── src/
│   │   │   └── index.ts          # 插件入口（activate / deactivate）
│   │   ├── package.json
│   │   └── README.md
│   └── .gitkeep
│
├── resources/                     # 应用资源（图标等）
│
├── scripts/                       # 构建 & 开发脚本
│   ├── dev.ts                     # 开发服务器启动脚本（Vite + preload + Electron）
│   └── spawn-utils.ts             # 跨平台子进程工具
│
├── tests/                         # 测试
│   ├── setup.ts                   # 测试环境初始化（mock window.electronAPI）
│   └── unit/
│       ├── components/            # 组件测试（18 个文件）
│       │   ├── AddressBar.test.tsx
│       │   ├── TabBar.test.tsx
│       │   ├── KLineChart.test.tsx
│       │   ├── StepEditor.test.tsx
│       │   ├── ExecutionPanel.test.tsx
│       │   ├── PluginCard.test.tsx
│       │   ├── PermissionDialog.test.tsx
│       │   ├── Sparkline.test.tsx
│       │   ├── RingGauge.test.tsx
│       │   ├── TaskTimeline.test.tsx
│       │   ├── CommandRegistry.test.ts
│       │   ├── WebViewContainer.test.tsx
│       │   ├── BrowserApp.regression.test.tsx
│       │   └── LoadingRegression.test.tsx
│       ├── services/              # 服务测试
│       │   ├── ConfigService.test.ts
│       │   ├── LogService.test.ts
│       │   ├── EventBus.test.ts
│       │   ├── IpcController.test.ts
│       │   ├── TabManager.test.ts
│       │   ├── WindowManager.test.ts
│       │   ├── TrayService.test.ts
│       │   ├── UpdateService.test.ts
│       │   ├── PermissionChecker.test.ts
│       │   ├── ToolRegistry.test.ts
│       │   ├── ContextManager.test.ts
│       │   └── AIService.test.ts
│       ├── engines/               # 引擎测试
│       │   ├── AutomationEngine.test.ts
│       │   ├── FlowRunner.test.ts
│       │   ├── RetryPolicy.test.ts
│       │   ├── SelectorGenerator.test.ts
│       │   ├── DataSourceManager.test.ts
│       │   └── IndicatorLibrary.test.ts
│       ├── shared/                # 共享工具测试
│       │   ├── constants.test.ts
│       │   ├── validator.test.ts
│       │   ├── logger.test.ts
│       │   └── format.test.ts
│       ├── config/
│       │   └── BuildConfig.test.ts
│       └── scripts/
│           └── spawn-utils.test.ts
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # CI：lint + typecheck + test + build
│   │   └── release.yml            # 自动发版（tag 触发）
│   └── ...
│
├── package.json
├── tsconfig.json                  # TypeScript 根配置
├── tsconfig.main.json             # 主进程 TS 配置
├── tsconfig.preload.json          # Preload TS 配置
├── tsconfig.renderer.json         # 渲染进程 TS 配置
├── vite.config.ts                 # Vite 配置（6 入口 MPA）
├── vitest.config.ts               # Vitest 测试配置
├── electron-builder.yml           # Electron Builder 打包配置
├── .eslintrc.cjs
├── .prettierrc
├── .editorconfig
├── .nvmrc
├── AGENTS.md                      # AI 代码助手仓库指南
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md
```

---

## 关键目录职责详解

### `src/main/` — Electron 主进程

| 目录/文件        | 职责                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `index.ts`       | 应用启动入口（异常捕获 + 初始化各服务）                                       |
| `app.ts`         | App 类封装生命周期（ready → init services → create window）                   |
| `windows/`       | 管理所有 BrowserWindow / WebContentsView 的创建、销毁、通信，上限 10 窗口     |
| `ipc/`           | IPC 通道注册、消息路由分发（限流 100/s）、EventBus 全局事件总线               |
| `ai/`            | AI 服务层：LLM 调度、上下文管理、工具注册 + 执行、Provider 切换               |
| `plugin-loader/` | 扫描 `plugins/` 目录、读取 `plugin.json`、三级权限校验、加载插件              |
| `browser/`       | WebContentsView 标签页管理（创建 / 导航 / 销毁，上限 20）                     |
| `services/`      | 系统级服务：SQLite 数据库（WAL 模式）、配置、日志（7 天轮转）、托盘、自动更新 |

### `src/renderer/entries/` — 多入口模块（Vite MPA，6 个入口）

每个子目录是一个独立入口，通过 `createEntry()` 工厂统一引导：

| 入口             | 说明                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `workbench/`     | 主工作台：模块导航、KPI 卡片、CommandPalette（Ctrl+K）、AIChatPanel（Ctrl+J） |
| `stock/`         | 股票分析：K 线图表、技术指标面板                                              |
| `automation/`    | 自动化采集：任务列表、步骤编辑器、执行面板                                    |
| `browser/`       | 浏览器会话控制台：多标签管理、地址栏、会话信息、WebViewContainer              |
| `plugin-center/` | 插件中心：本地安装、插件卡片、权限授权弹窗                                    |
| `plugin-host/`   | 插件宿主容器（受限 API 集 + PluginBridge 桥接）                               |

### `src/renderer/shared/` — 渲染进程共享

| 目录          | 关键文件                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/` | PageShell、TitleBar、ErrorBoundary、GlobalLoading、AppProviders、AdminPageLayout、Sparkline、TaskTimeline、RingGauge、CommandPalette/、AIChatPanel/ |
| `hooks/`      | useIpc（IPC 调用）、useEventBus（事件订阅）、useLoading（全局加载态）                                                                               |
| `styles/`     | globals.css、theme.ts                                                                                                                               |
| `utils/`      | format.ts（数字/日期格式化）                                                                                                                        |

### `src/shared/` — 跨进程共享

此目录的代码会被主进程和渲染进程同时引用：

- `types/`：IPC、插件、任务、股票、配置、浏览器、AI 等类型定义
- `constants/`：60+ IPC 通道名、三级权限常量、20+ 事件名
- `utils/`：Zod 校验、日志格式化

### `src/engines/` — 核心引擎

引擎运行在主进程侧：

| 引擎       | 核心文件               | 说明                                                    |
| ---------- | ---------------------- | ------------------------------------------------------- |
| 自动化引擎 | `AutomationEngine.ts`  | 5 种操作：click / input / scroll / extract / screenshot |
| 自动化引擎 | `FlowRunner.ts`        | Flow → Step → Action 执行链 + 断点续跑                  |
| 自动化引擎 | `SelectorGenerator.ts` | CSS 选择器自动生成（唯一性评分）                        |
| 自动化引擎 | `RetryPolicy.ts`       | 指数退避重试策略                                        |
| 分析引擎   | `DataSourceManager.ts` | REST / WebSocket 数据源管理                             |
| 分析引擎   | `IndicatorLibrary.ts`  | 技术指标：MA / MACD / RSI / BOLL                        |

---

## 新增模块扩展指南

要新增一个业务模块（如"PDF 工具"），只需：

1. 在 `src/renderer/entries/` 下创建 `pdf-tools/` 目录
2. 添加 `index.html` + `main.tsx` + `App.tsx`
3. 在 `vite.config.ts` 的 `input` 中注册新入口
4. 在主工作台首页 `Home.tsx` 中添加模块导航卡片
5. 在 `WindowManager.ts` 中注册模块窗口配置

模块入口保持低耦合，跨窗口事件统一经主进程中转。
