# SPEC · Headless Runner V1（草案）

> 状态：**草案 / HR-M1 CLI 起步 + Playwright adapter 基础版（`run` 与 `list tasks/batches` 已落地）**
> 关联：[design/next-phase-ideas.md §2.1](../design/next-phase-ideas.md#21-方向-a--headless-runner--cli产品形态升维)  
> 与主线关系：**副线，不替代** [specs/automation-browser-ops-v1.md](automation-browser-ops-v1.md)；只新增「Headless Runner 模式」。

## 当前实施状态（截至 2026-04-20）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| HR-M0 依赖盘点 | ✅ 已完成 | 已扫描 `src/main`、`src/engines`、`src/shared`、`src/cli` 中对 `electron` 的直接依赖，并整理去耦边界 |
| `AutomationPage` 最小接口 | ✅ 已完成 | 已新增 `src/engines/automation/types.ts` 中的 `AutomationPage` / `AutomationPageImage`，用于替代自动化执行链对 Electron `WebContents` 类型的暴露 |
| 自动化执行链去 Electron 类型 | ✅ 已完成 | `AutomationEngine`、`FlowRunner`、`SelectorGenerator`、`TaskService.startTask/resumeTask` 已改为依赖 `AutomationPage`；新增边界测试防止回退 |
| `src/runner/` 目录 | 🟡 已起步 | 已新增 `src/runner/cli/list.ts`，提供最小只读查询入口；RunnerHost / DaemonHost 仍未创建 |
| CLI `run/list/daemon` | 🟡 部分实现 | 已支持 `yclaw run <taskId>`、`yclaw list tasks`、`yclaw list batches --task <id>`；`daemon` 尚未实现 |
| Headless 浏览器后端 | 🟡 基础 adapter 已接入 | 已新增 Playwright 风格 `AutomationPage` adapter，可承接 `executeJavaScript()` / `capturePage()`；支持 `--browser-executable` / `YCLAW_BROWSER_EXECUTABLE` 指向系统 Chrome/Edge |
| 桌面远程 Runner 配置 UI | ⬜ 未开始 | 仍停留在本 spec 草案 |

---

## 1. 目标

把 YClaw 的核心自动化执行能力（任务、批次、调度、会话、结果、日志）封装成一个 **可在 Electron 之外独立运行** 的 headless runner，使同一套引擎能在以下三种形态下复用：

| 形态 | 入口 | 用途 |
| --- | --- | --- |
| Desktop | `electron` 主进程内嵌 | 现有桌面端，**保持完全兼容** |
| CLI | `yclaw <command>` | 服务器、CI、cron、脚本嵌入 |
| Daemon | `yclaw daemon`（HTTP/IPC 端点） | 长驻服务，桌面端可远程连接 |

---

## 2. 非目标（明确不做）

- 不做远程多用户认证 / 团队协作（远期）。
- 不在 headless 模式提供「窗口介入」「托盘」「插件 UI」等强桌面耦合能力。
- 不引入新的 DB 引擎，沿用 SQLite。
- 不做云端同步。

---

## 3. 验收标准

| ID | 描述 |
| --- | --- |
| HR-01 | `yclaw run <taskId>` 可在无 Electron 环境下执行任务，产出与桌面端一致的批次记录与结果。 |
| HR-02 | `yclaw list tasks` / `yclaw list batches --task <id>` 可读取任务与批次状态。 |
| HR-03 | `yclaw daemon --port 7421` 启动后，桌面客户端可通过「远程 Runner」配置连接并复用其任务、结果、日志。 |
| HR-04 | Headless 模式下使用的 SQLite 数据目录可通过 `--data-dir` / `YCLAW_DATA_DIR` 配置，且与桌面端可隔离。 |
| HR-05 | 浏览器自动化在 headless 模式默认 `headless: true`，可通过 `--headed` 切换。 |
| HR-06 | 现有桌面端使用方式 **零回归**：所有 Desktop 模式的功能保持原样。 |
| HR-07 | `yclaw --help` 输出所有命令、参数、退出码说明。 |
| HR-08 | CLI 退出码遵循 `0=成功、1=任务失败、2=配置错误、3=运行时错误`。 |
| HR-09 | 输出有 `--output json` 模式，便于脚本消费。 |
| HR-10 | 文档：`docs/specs/headless-runner-v1.md`、根 README 增加 CLI 使用示例。 |

---

## 4. 架构改造要点

### 4.1 引入 `RunnerHost` 抽象

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ ElectronHost │       │   CliHost    │       │  DaemonHost  │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       └────────── 共用 ──────┼──────────────────────┘
                              ▼
                ┌─────────────────────────────┐
                │ Core Services（无 UI 依赖） │
                │  TaskService / BatchService │
                │  SchedulerService           │
                │  AutomationEngine           │
                │  SessionRegistry            │
                │  DatabaseService            │
                │  LogService                 │
                └─────────────────────────────┘
```

- 把 `src/main/services/` 下的核心服务从「Electron app 装配」中剥离，使它们 **只依赖 Node**。
- 新建 `src/runner/` 目录，存放 `RunnerHost` 接口与三种实现：
  - `runner/electron/` —— 沿用现有 `src/main/app.ts` 的装配。
  - `runner/cli/` —— `yclaw` CLI 入口。
  - `runner/daemon/` —— HTTP 端点（基于 `fastify` 或原生 `http`）。

### 4.2 CLI 入口结构

```
yclaw run    <taskId>  [--headed] [--browser-executable <path>] [--output json] [--timeout 60s]
yclaw list   tasks
yclaw list   batches  --task <id>  [--limit 20]
yclaw show   batch    <batchId>    [--with-logs]
yclaw export results  --task <id>  --format jsonl|csv  --out <path>
yclaw daemon          [--port 7421] [--bind 127.0.0.1]
yclaw config          [get|set|list]
```

### 4.3 Daemon HTTP 协议（草案）

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `GET /tasks` | 任务列表 |
| `POST /tasks/:id/run` | 触发执行，返回 batchId |
| `GET /batches/:id` | 批次状态 |
| `GET /batches/:id/logs?stream=1` | SSE 实时日志 |
| `GET /results?task=:id&limit=` | 结果分页 |
| `POST /sessions/:id/refresh` | 重新建立登录态 |

- 默认 **仅监听 127.0.0.1**，不开放公网。
- 鉴权：v1 仅支持 token（`YCLAW_TOKEN`），不做用户体系。

### 4.4 HR-M0 Electron 依赖盘点

> 盘点时间：2026-04-20。目标是先识别哪些文件必须保留 Desktop 专属，哪些核心服务需要抽象端口后才能在 Headless Runner 中复用。

| 文件 | 依赖类型 | 当前用途 | 去耦建议 |
| --- | --- | --- | --- |
| `src/main/app.ts` | 运行时 `electron` | Desktop App 装配、窗口、对话框、生命周期 | 保持 DesktopHost 专属；未来抽取 Core Services 工厂供 CLI/Daemon 复用 |
| `src/main/index.ts` | 运行时 `electron` | Electron 应用入口 | 保持 Desktop 专属；Headless 使用独立 CLI 入口 |
| `src/main/windows/WindowManager.ts` | 运行时 `BrowserWindow` | 桌面窗口管理 | 保持 Desktop 专属；RunnerHost 只暴露 capability，不复用窗口管理 |
| `src/main/windows/preload.ts` | 运行时 `contextBridge/ipcRenderer` | 渲染进程桥接 | 保持 Desktop 专属；headless 不加载 preload |
| `src/main/ipc/IpcController.ts` | 运行时 `ipcMain` | Electron IPC handler 注册 | 抽象为 `CommandRouter` / handler registry；Desktop adapter 绑定 `ipcMain` |
| `src/main/browser/TabManager.ts` | 运行时 `WebContentsView/session` | 浏览器标签页与会话分区 | 抽象 `BrowserHost` / `BrowserPageHandle`；Desktop 用 WebContentsView，Headless 用 Playwright/Chromium |
| `src/main/services/TrayService.ts` | 运行时 `Tray/Menu/nativeImage/app` | 系统托盘 | Desktop 专属；headless 不加载 |
| `src/main/utils/paths.ts` | 动态 `require('electron')` + fallback | 获取 userData / DB / log 路径 | 已具备 `YCLAW_DATA_DIR` 与 `~/.yclaw` fallback；可作为 headless 早期路径层继续复用 |
| `src/main/services/TaskService.ts` | type-only `WebContents` | `startTask/resumeTask` 接收页面执行对象 | 将参数替换为最小接口，如 `AutomationPage`，避免服务层暴露 Electron 类型 |
| `src/engines/automation/AutomationEngine.ts` | type-only `WebContents`，运行依赖其 API | 使用 `executeJavaScript()` 与 `capturePage()` 执行动作 | 抽象 `AutomationPage`：`executeJavaScript<T>()`、`capturePage(): Promise<{ toDataURL(): string }>` |
| `src/engines/automation/FlowRunner.ts` | type-only `WebContents` | 将页面对象传递给 `AutomationEngine.execute()` | 跟随 `AutomationEngine` 改为 `AutomationPage` |
| `src/engines/automation/SelectorGenerator.ts` | type-only `WebContents` | 使用 `executeJavaScript()` 生成/校验选择器 | 跟随 `AutomationPage`，只依赖 JS 执行能力 |

### 4.5 建议去耦顺序

| 顺序 | 工作项 | 验收口径 |
| --- | --- | --- |
| 1 | 新增 `AutomationPage` 最小类型，不改行为 | ✅ 现有 Electron 调用点可通过结构类型满足接口，测试不回归；`BrowserHost` 仍待后续抽象 |
| 2 | 将 `AutomationEngine`、`FlowRunner`、`SelectorGenerator` 从 `WebContents` 类型迁移到 `AutomationPage` | ✅ `src/engines/automation` 不再 import `electron` |
| 3 | 将 `TaskService.startTask/resumeTask` 参数迁移到 `AutomationPage` | ✅ `src/main/services/TaskService.ts` 不再 import `electron` |
| 4 | 为 `TabManager` 增加 Desktop adapter，预留 Headless adapter | Desktop 行为保持不变 |
| 5 | 新建 `src/runner/cli/`，先接 `list tasks` / `list batches` 等只读命令 | CLI 可在无 Electron 环境启动基础服务 |

### 4.6 HR-M1 前置去耦记录

| 项 | 结果 |
| --- | --- |
| 最小页面接口 | `AutomationPage` 只要求 `executeJavaScript<T>()` 与 `capturePage().toDataURL()`，Electron `webContents` 可通过结构类型直接兼容 |
| 执行链迁移 | `AutomationEngine`、`FlowRunner`、`SelectorGenerator` 不再导入 `electron` |
| 服务层边界 | `TaskService.startTask()` / `TaskService.resumeTask()` 不再使用 Electron 类型，方便后续 CLI/Daemon 注入 headless 页面句柄 |
| 回归保护 | 新增 `tests/unit/engines/headless-boundary.spec.ts`，防止自动化执行链重新暴露 `electron` / `WebContents` |
| CLI 起步 | 新增 `src/runner/cli/list.ts` 与 `src/runner/cli/run.ts`；`run` 会创建/启动/完成或失败 batch，并更新任务状态 |
| Headless adapter | 新增 `src/runner/browser/PlaywrightAutomationPage.ts`，将 Playwright `page.evaluate()` / `page.screenshot()` 适配为 `AutomationPage` |
| 浏览器路径配置 | `yclaw run` 支持 `--browser-executable <path>`；也可通过 `YCLAW_BROWSER_EXECUTABLE` 指向系统 Chrome/Edge |
| 当前限制 | 默认 `run` 已可执行空步骤任务；含页面动作任务会尝试启动 Playwright Chromium 或指定浏览器，本地需具备可用浏览器环境 |
| 下一步 | 完成浏览器自动发现/分发策略、真实站点验收，再向 `daemon` 形态扩展 |

---

## 5. 影响面

| 模块 | 影响 |
| --- | --- |
| `src/main/services/*` | 需要逐步去除对 `electron` 模块的直接 import；改为通过 `RunnerHost` 注入。 |
| `src/main/browser/*` | TabManager 需区分「真实窗口」与「headless Playwright」两种执行后端。 |
| `src/main/plugin-loader/*` | 插件 v1 默认仅在 Desktop 模式下加载；headless 模式不加载（明确写入文档）。 |
| `src/shared/*` | 新增 `RunnerCapabilities` 类型，用于宣告当前 host 的能力集合。 |
| 测试 | 新增 `tests/unit/runner/cli.spec.ts`、`tests/integration/runner/daemon.spec.ts`。 |

---

## 6. 里程碑

| 里程碑 | 内容 |
| --- | --- |
| HR-M0 | 服务层依赖梳理：列出当前所有「直接 import electron」的位置，给出去耦计划。 |
| HR-M1 | 进行中：自动化执行链已完成 `AutomationPage` 前置去耦，且已跑通 CLI `run`、`list tasks`、`list batches`。 |
| HR-M2 | 部分起步：基础 Playwright adapter 已接入，并支持显式系统 Chrome/Edge 路径；浏览器自动发现/分发策略、复杂站点验收仍待实现。 |
| HR-M3 | `DaemonHost` HTTP 端点 + 桌面端「远程 Runner」客户端配置 UI。 |
| HR-M4 | 验收：完整跑通 HR-01 ~ HR-10。 |

---

## 7. 与现有 spec 的关系

| 现有 spec | 关系 | 说明 |
| --- | --- | --- |
| [specs/v1.0-baseline.md](v1.0-baseline.md) | 兼容 | 不修改基线规格，只新增形态。 |
| [specs/v1.1-enhancements.md](v1.1-enhancements.md) | 并行 | 互不依赖。 |
| [specs/automation-browser-ops-v1.md](automation-browser-ops-v1.md) | 复用 | 自动化采集的 SPEC-A01 ~ A07 在 headless 模式下同等适用。 |

---

## 8. 风险与开放问题

| 项 | 描述 |
| --- | --- |
| `better-sqlite3` 在 headless 部署 | 需提供预编译产物或文档化构建依赖。 |
| 浏览器二进制大小 | Playwright 默认 ~300MB，需评估是否提供「自带浏览器 / 复用系统 Chrome」两种发行形态。 |
| 插件兼容 | headless 模式插件加载默认关闭，需同步更新 [specs/v1.0-baseline.md](v1.0-baseline.md) 中插件章节的「适用形态」描述。 |
| Token 鉴权强度 | v1 简单 token 是否足够？若开放给团队使用，需要在 v2 升级到双向 mTLS。 |
