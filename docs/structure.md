# 📁 YClaw 项目文件结构规划

> 多入口 + 插件框架 | Electron + React + Vite

## 目录总览

```
yclaw/
├── docs/                          # 项目文档
│   ├── prd.md                     # 产品需求文档
│   ├── structure.md               # 本文件 — 项目结构规划
│   ├── architecture.md            # 技术架构图
│   ├── plan.md                    # 可行性分析 & 实施计划
│   └── specs.md                   # V1.0 Spec 拆解
│
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # 主进程入口
│   │   ├── app.ts                 # 应用生命周期管理
│   │   ├── windows/               # 窗口管理
│   │   │   ├── WindowManager.ts   # 窗口创建 / 销毁 / 状态管理
│   │   │   └── preload.ts         # 预加载脚本（contextBridge 安全暴露 API）
│   │   ├── ipc/                   # IPC 通信层
│   │   │   ├── IpcController.ts   # IPC 路由注册与分发
│   │   │   ├── channels.ts        # IPC 通道定义（类型安全）
│   │   │   └── EventBus.ts        # 全局事件总线（跨模块通信）
│   │   ├── plugin-loader/         # 插件加载器（主进程侧）
│   │   │   ├── PluginLoader.ts    # 插件扫描、校验、加载
│   │   │   ├── PluginRegistry.ts  # 插件注册表（元信息管理）
│   │   │   └── PermissionChecker.ts # 权限校验（三级权限模型 + 受信来源策略）
│   │   ├── services/              # 系统服务
│   │   │   ├── DatabaseService.ts # SQLite 数据库服务（better-sqlite3）
│   │   │   ├── StorageService.ts  # 文件存储服务
│   │   │   ├── ConfigService.ts   # 配置管理服务
│   │   │   ├── LogService.ts      # 日志服务（文件 + 控制台）
│   │   │   ├── UpdateService.ts   # 自动更新服务
│   │   │   └── TrayService.ts     # 系统托盘服务
│   │   └── utils/                 # 主进程工具函数
│   │       └── paths.ts           # 应用路径管理
│   │
│   ├── renderer/                  # 渲染进程（React + Vite 多入口）
│   │   ├── entries/               # 🔑 多入口根目录（每个子目录 = 独立入口）
│   │   │   ├── workbench/         # 主工作台（默认入口）
│   │   │   │   ├── index.html     # HTML 入口
│   │   │   │   ├── main.tsx       # React 入口
│   │   │   │   ├── App.tsx        # 根组件
│   │   │   │   ├── routes.tsx     # 路由配置
│   │   │   │   ├── store/         # Zustand 状态管理
│   │   │   │   ├── pages/         # 页面组件
│   │   │   │   │   ├── Home.tsx   # 首页（模块导航）
│   │   │   │   │   └── Settings.tsx # 设置页
│   │   │   │   ├── components/    # 局部组件
│   │   │   │   └── styles/        # 样式
│   │   │   │
│   │   │   ├── stock/             # 股票分析模块
│   │   │   │   ├── index.html
│   │   │   │   ├── main.tsx
│   │   │   │   ├── App.tsx
│   │   │   │   ├── store/
│   │   │   │   │   └── stockStore.ts
│   │   │   │   ├── pages/
│   │   │   │   │   ├── Dashboard.tsx    # 行情看板
│   │   │   │   │   ├── ChartView.tsx    # K 线图表
│   │   │   │   │   └── StrategyEditor.tsx # 策略编辑器
│   │   │   │   ├── components/
│   │   │   │   │   ├── KLineChart.tsx   # K 线组件
│   │   │   │   │   ├── IndicatorPanel.tsx # 指标面板
│   │   │   │   │   └── DataSourceConfig.tsx
│   │   │   │   └── services/
│   │   │   │       ├── dataSource.ts    # 行情数据源接入
│   │   │   │       └── indicators.ts    # 技术指标计算
│   │   │   │
│   │   │   ├── automation/        # 自动化采集模块
│   │   │   │   ├── index.html
│   │   │   │   ├── main.tsx
│   │   │   │   ├── App.tsx
│   │   │   │   ├── store/
│   │   │   │   │   └── taskStore.ts
│   │   │   │   ├── pages/
│   │   │   │   │   ├── TaskList.tsx     # 任务列表
│   │   │   │   │   ├── FlowEditor.tsx   # 任务流编辑器
│   │   │   │   │   └── TaskRunner.tsx   # 任务执行面板
│   │   │   │   └── components/
│   │   │   │       ├── StepCard.tsx     # 步骤卡片
│   │   │   │       └── ActionPicker.tsx # 动作选择器
│   │   │   │
│   │   │   ├── browser/           # 内嵌浏览器模块
│   │   │   │   ├── index.html
│   │   │   │   ├── main.tsx
│   │   │   │   ├── App.tsx
│   │   │   │   ├── store/
│   │   │   │   │   └── tabStore.ts
│   │   │   │   ├── pages/
│   │   │   │   │   └── BrowserView.tsx  # 浏览器主界面
│   │   │   │   └── components/
│   │   │   │       ├── TabBar.tsx       # 标签栏
│   │   │   │       ├── AddressBar.tsx   # 地址栏
│   │   │   │       └── WebViewContainer.tsx # WebContentsView 容器
│   │   │   │
│   │   │   └── plugin-center/     # 插件中心模块
│   │   │       ├── index.html
│   │   │       ├── main.tsx
│   │   │       ├── App.tsx
│   │   │       ├── pages/
│   │   │       │   ├── PluginMarket.tsx   # 插件市场 / 列表
│   │   │       │   └── PluginDetail.tsx   # 插件详情
│   │   │       └── components/
│   │   │           ├── PluginCard.tsx     # 插件卡片
│   │   │           └── PermissionDialog.tsx # 权限授权弹窗
│   │   │
│   │   ├── shared/                # 渲染进程共享代码
│   │   │   ├── components/        # 通用 UI 组件
│   │   │   │   ├── Layout/        # 布局组件（Sidebar / Header / Content）
│   │   │   │   ├── Modal/
│   │   │   │   └── Toast/
│   │   │   ├── hooks/             # 通用 React Hooks
│   │   │   │   ├── useIpc.ts      # IPC 调用 Hook
│   │   │   │   └── useEventBus.ts # 事件总线 Hook
│   │   │   ├── styles/            # 全局样式 / 主题
│   │   │   │   ├── globals.css
│   │   │   │   └── theme.ts
│   │   │   └── utils/             # 渲染进程工具函数
│   │   │       └── format.ts
│   │   │
│   │   └── plugin-host/           # 插件宿主容器（V1.0 共享宿主页）
│   │       ├── index.html         # 插件宿主页 HTML
│   │       ├── preload.ts         # 插件专用 preload（受限 API 集）
│   │       └── PluginBridge.ts    # 插件 API 桥接层
│   │
│   ├── shared/                    # 跨进程共享代码（主进程 + 渲染进程）
│   │   ├── types/                 # TypeScript 类型定义
│   │   │   ├── ipc.ts             # IPC 消息类型
│   │   │   ├── plugin.ts          # 插件相关类型
│   │   │   ├── task.ts            # 自动化任务类型
│   │   │   ├── stock.ts           # 股票数据类型
│   │   │   └── config.ts          # 配置类型
│   │   ├── constants/             # 共享常量
│   │   │   ├── channels.ts        # IPC 通道名常量
│   │   │   ├── permissions.ts     # 权限级别常量
│   │   │   └── events.ts          # 事件名常量
│   │   └── utils/                 # 跨进程工具函数
│   │       ├── validator.ts       # 数据校验工具
│   │       └── logger.ts          # 统一日志格式
│   │
│   └── engines/                   # 核心引擎（主进程侧运行）
│       ├── automation/            # 自动化引擎
│       │   ├── AutomationEngine.ts    # 引擎入口
│       │   ├── ActionExecutor.ts      # 动作执行器（点击/输入/滚动/采集）
│       │   ├── FlowRunner.ts          # 任务流运行器（Flow → Step → Action）
│       │   ├── SelectorGenerator.ts   # 选择器生成
│       │   ├── RetryPolicy.ts         # 错误重试 & 断点继续逻辑
│       │   └── types.ts               # 引擎类型定义
│       │
│       └── analytics/             # 数据分析引擎
│           ├── AnalyticsEngine.ts     # 引擎入口
│           ├── DataSourceManager.ts   # 数据源管理（REST / WebSocket）
│           ├── IndicatorLibrary.ts    # 技术指标库（MA / MACD / RSI / BOLL）
│           ├── StrategyRunner.ts      # JS 策略沙箱执行
│           ├── PythonBridge.ts        # Python 策略桥接（child_process）
│           └── types.ts               # 引擎类型定义
│
├── plugins/                       # 📦 插件目录 & 开发模板
│   ├── _template/                 # 插件开发模板
│   │   ├── plugin.json           # 插件元信息（名称/版本/权限声明/入口）
│   │   ├── src/
│   │   │   ├── index.ts          # 插件入口（activate / deactivate）
│   │   │   └── ui/               # 插件 UI（可选）
│   │   │       └── Panel.tsx
│   │   ├── package.json
│   │   └── README.md
│   └── .gitkeep                  # 保留目录
│
├── resources/                     # 应用资源（图标 / 原生依赖）
│   ├── icon.icns                  # macOS 图标
│   ├── icon.ico                   # Windows 图标
│   ├── icon.png                   # Linux 图标
│   └── tray-icon.png              # 托盘图标
│
├── scripts/                       # 构建 & 开发脚本
│   ├── dev.ts                     # 开发服务器启动脚本
│   ├── build.ts                   # 生产构建脚本
│   └── plugin-scaffold.ts         # 插件脚手架生成器
│
├── tests/                         # 测试
│   ├── unit/                      # 单元测试
│   │   ├── engines/
│   │   ├── services/
│   │   └── shared/
│   ├── integration/               # 集成测试
│   │   ├── ipc/
│   │   └── plugin-loader/
│   └── e2e/                       # E2E 测试（Playwright）
│       └── app.spec.ts
│
├── .github/                       # GitHub 配置
│   └── workflows/
│       └── ci.yml                 # CI 流水线
│
├── package.json                   # 项目依赖 & Scripts
├── tsconfig.json                  # TypeScript 根配置
├── tsconfig.main.json             # 主进程 TS 配置
├── tsconfig.renderer.json         # 渲染进程 TS 配置
├── vite.config.ts                 # Vite 配置（多入口 MPA）
├── electron-builder.yml           # Electron Builder 打包配置
├── .eslintrc.cjs                  # ESLint 配置
├── .prettierrc                    # Prettier 配置
├── .gitignore
└── README.md                      # 项目说明
```

---

## 关键目录职责详解

### `src/main/` — Electron 主进程

| 目录/文件 | 职责 |
|-----------|------|
| `index.ts` | 应用启动入口，初始化各服务 |
| `windows/` | 管理所有 BrowserWindow / WebContentsView 的创建、销毁、通信 |
| `ipc/` | IPC 通道注册、消息路由分发、全局事件总线 |
| `plugin-loader/` | 扫描 `plugins/` 目录、读取 `plugin.json`、校验来源策略与权限、注册插件 |
| `services/` | 系统级服务：数据库(SQLite)、文件存储、配置、日志、更新、托盘 |

### `src/renderer/entries/` — 多入口模块（Vite MPA）

每个子目录是一个**独立的 Vite 入口**，拥有：
- 独立的 `index.html` + `main.tsx`
- 独立的路由（`routes.tsx`）
- 独立的状态管理（`store/`）
- 独立的页面和组件

**Vite 配置方式**：
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        workbench: resolve(__dirname, 'src/renderer/entries/workbench/index.html'),
        stock: resolve(__dirname, 'src/renderer/entries/stock/index.html'),
        automation: resolve(__dirname, 'src/renderer/entries/automation/index.html'),
        browser: resolve(__dirname, 'src/renderer/entries/browser/index.html'),
        'plugin-center': resolve(__dirname, 'src/renderer/entries/plugin-center/index.html'),
        'plugin-host': resolve(__dirname, 'src/renderer/plugin-host/index.html'),
      }
    }
  }
})
```

### `src/renderer/plugin-host/` — 插件共享宿主（V1.0）

| 文件 | 职责 |
|------|------|
| `index.html` | 受控插件 UI 运行环境 |
| `preload.ts` | 受限 API 集（仅暴露插件权限范围内的能力） |
| `PluginBridge.ts` | 插件与宿主通信的桥接层（消息格式定义、权限拦截） |

### `src/shared/` — 跨进程共享

此目录的代码会被主进程和渲染进程同时引用：
- `types/`：IPC 消息、插件、任务等的 TypeScript 类型定义，确保类型安全
- `constants/`：IPC 通道名、权限级别、事件名等常量，避免硬编码
- `utils/`：数据校验、日志格式化等跨进程通用逻辑

### `src/engines/` — 核心引擎

引擎运行在**主进程侧**（可通过 Worker 线程避免阻塞）：

| 引擎 | 核心文件 | 说明 |
|------|---------|------|
| 自动化引擎 | `AutomationEngine.ts` | 通过 WebContentsView.webContents 操作页面 DOM |
| 自动化引擎 | `FlowRunner.ts` | 解析 Flow → Step → Action 执行链 |
| 分析引擎 | `DataSourceManager.ts` | 管理 REST / WebSocket 数据源连接 |
| 分析引擎 | `PythonBridge.ts` | child_process 调用本地 Python |

### `plugins/_template/` — 插件开发模板

```json
// plugin.json 示例
{
  "name": "my-plugin",
  "version": "1.0.0",
  "displayName": "My Plugin",
  "description": "A sample plugin",
  "main": "dist/index.js",
  "ui": "dist/ui/Panel.html",
  "permissions": ["network", "storage"],
  "permissionLevel": 2,
  "source": "local",
  "engines": {
    "yclaw": ">=1.0.0"
  }
}
```

---

## 构建产物结构

```
dist/
├── main/                    # 主进程编译产物
│   └── index.js
├── renderer/                # 渲染进程编译产物
│   ├── workbench/
│   │   └── index.html
│   ├── stock/
│   │   └── index.html
│   ├── automation/
│   │   └── index.html
│   ├── browser/
│   │   └── index.html
│   ├── plugin-center/
│   │   └── index.html
│   └── plugin-host/
│       └── index.html
└── shared/                  # 共享模块编译产物
```

---

## 新增模块扩展指南

要新增一个业务模块（如"PDF 工具"），只需：

1. 在 `src/renderer/entries/` 下创建 `pdf-tools/` 目录
2. 添加 `index.html` + `main.tsx` + `App.tsx`
3. 在 `vite.config.ts` 的 `input` 中注册新入口
4. 在主工作台首页 `Home.tsx` 中添加模块导航卡片
5. 在 `WindowManager.ts` 中注册模块窗口配置

模块入口保持低耦合，但跨窗口事件统一经主进程中转，不直接依赖渲染进程对等通信。
