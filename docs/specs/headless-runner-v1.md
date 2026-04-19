# SPEC · Headless Runner V1（草案）

> 状态：**草案 / 待评审**  
> 关联：[design/next-phase-ideas.md §2.1](../design/next-phase-ideas.md#21-方向-a--headless-runner--cli产品形态升维)  
> 与主线关系：**副线，不替代** [specs/automation-browser-ops-v1.md](automation-browser-ops-v1.md)；只新增「Headless Runner 模式」。

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
yclaw run    <taskId>  [--headed] [--output json] [--timeout 60s]
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
| HR-M1 | `CliHost` 跑通 `run` / `list tasks` / `list batches`，复用现有 SQLite。 |
| HR-M2 | 浏览器执行后端抽象：Playwright headless 通道接入，与现有 WebContentsView 并存。 |
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
