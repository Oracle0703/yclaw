# YClaw 下一阶段拓展思路（设计探索）

> 本文档是 **设计探索性质** 的方向草案，不是规格。  
> 已采纳的方向会落地到 [`docs/specs/`](../specs/)，已排期的会落地到 [`docs/plans/`](../plans/)。  
> 阅读前建议先看 [overview/roadmap.md](../overview/roadmap.md)，本文是它的「副线补充」。

---

## 1. 写这篇文档的动机

[overview/roadmap.md](../overview/roadmap.md) 已经把「自动化采集闭环 → 介入 → 录制 → AI 助理 → 插件生态」这条主线讲清楚了，是合理的近期路线。但它是在 **当前产品形态（桌面壳里的自动化工具）** 内做横向扩展。

如果只沿这条路走，YClaw 的天花板会被「桌面端单机产品」框住。本文从 **产品形态升维** 角度提出一组副线方向，让 YClaw 在不破坏主线的前提下，逐步演化成「**可被外部生态消费的自动化采集引擎**」。

---

## 2. 候选方向

### 2.1 方向 A — Headless Runner / CLI（产品形态升维）

把核心引擎（`AutomationEngine`、`FlowRunner`、`SchedulerService`、`TaskService`、`BatchService`、`SessionRegistry` 等）从 Electron 主进程里 **解耦** 出来，封装成一个可独立运行的 headless 二进制 / Node 进程。

- **场景**
  - 任务可以跑在服务器、CI、Docker、cron 里，不再绑定桌面壳。
  - 桌面客户端可以「连远程 runner」，多人共享同一套任务。
  - 用户可以用 `yclaw run task-id` 在脚本里嵌入自动化步骤。
- **改造抓手**
  - 引入「Runner 接口」抽象（local / remote / headless）。
  - 主进程现有的服务大多已经是接口式封装，存量代码改动可控。
  - 浏览器侧需要 headless / headed 双模式切换（Playwright 已支持）。
- **风险**
  - Electron 强耦合的能力（窗口介入、托盘）需明确「不在 headless 模式提供」。
  - Session/Cookie 存储位置需要可配置，避免和桌面端冲突。
- **杠杆评估**：⭐⭐⭐⭐⭐  
  - 一旦拆开，C/D/E 三个方向几乎都能复用。
- **落地参考 spec**：[specs/headless-runner-v1.md](../specs/headless-runner-v1.md)

---

### 2.2 方向 B — Task-as-Code（任务即代码）

把任务、模板、规则、调度配置从「数据库中的不可见结构」变成 **可导出/导入的文本（YAML 或 TS）**，可放进 Git 仓库管理。

- **场景**
  - 任务定义可以在 Git 仓库里 PR review、diff、回滚。
  - 团队成员通过 clone 仓库就能拿到全套任务，不需要逐项复制。
  - 任务和模板可以打包发布到「采集脚本市场」（远期）。
  - CI 里可以 `yclaw lint task.yaml` 校验配置合法性。
- **改造抓手**
  - 现有 `TaskService` / `TemplateService` 已经把数据结构定义清楚。
  - 只需要补「序列化层」（DB ↔ 文件）+ 一个 `import/export` 命令。
- **风险**
  - 需要稳定的 schema 版本号与迁移机制，避免老版本任务被新版本破坏。
- **杠杆评估**：⭐⭐⭐⭐  
  - 工作量小、立即可用、是「团队协作」与「插件市场」的前置。
- **落地参考 spec**：[specs/task-as-code-v1.md](../specs/task-as-code-v1.md)

---

### 2.3 方向 C — MCP（Model Context Protocol）集成

把 YClaw 的任务、结果、日志、会话作为一组工具暴露成 **MCP server**，让外部 LLM agent（Claude Desktop、Cursor、Continue 等）能直接调用。

- **场景**
  - 用户在 Claude Desktop 里说「帮我看下昨晚 3 个采集任务为什么失败」，Claude 通过 MCP 拿到 YClaw 的批次/日志/截图，给出诊断。
  - 用户在 Cursor 里说「跑一下 task-42 并把结果存到 ./data」，由 Cursor 通过 MCP 触发 YClaw runner。
  - 反过来，YClaw 自身的 AI 助手可以做 MCP **client**，复用社区已有的 MCP 工具（文件、git、浏览器、数据库）。
- **改造抓手**
  - 现有 `ToolRegistry`、`AIService` 已经是工具调用模型，向 MCP 协议适配主要是「换底层传输层」。
  - SDK 成熟（`@modelcontextprotocol/sdk`），不必从零实现。
- **风险**
  - 权限边界必须严格设计（哪些操作允许外部 agent 触发，哪些只允许只读）。
  - 需要稳定的「Tool Schema」版本管理。
- **杠杆评估**：⭐⭐⭐⭐  
  - 低成本接入主流 AI 生态，比自己做主动智能助手 ROI 高得多。
- **落地参考 spec**：[specs/mcp-integration-v1.md](../specs/mcp-integration-v1.md)

---

### 2.4 方向 D — 数据出口与可观测性（暂未拆 spec）

让结果数据可被外部 BI / Notebook 直接消费；让任务运行有标准可观测输出。

- **数据侧**
  - SQLite 之外，提供「结果表导出 Parquet/CSV/JSONL」批量出口。
  - 可选启用 DuckDB 作为分析视图（直接读 SQLite 文件）。
  - 提供 `GET /results?task=xxx` 的本地 HTTP API（Headless Runner 模式下）。
- **可观测侧**
  - 任务/批次/步骤的关键指标暴露成 Prometheus `/metrics` 端点。
  - 执行链路按 OpenTelemetry trace 输出，可对接 Jaeger / Grafana Tempo。
- **杠杆评估**：⭐⭐⭐  
  - 是「专业用户/团队场景」的必需品，但单机用户感知弱，建议在 A/B 之后再启动。

---

### 2.5 方向 E — Snapshot Replay（采集回放）

每次采集时把请求 / 响应 / DOM / 关键截图按 batch 存档，支持「离线回放」：在不重新访问真实站点的前提下，用存档数据重新跑一遍提取规则。

- **价值**
  - 调试规则不必反复访问真实站点（避免被封）。
  - 升级提取规则后可以对历史 batch **回归跑一遍**，看输出有没有漂移。
  - 生成自动化测试用例的天然来源。
- **改造抓手**
  - `RecorderPanel` 已经在收集事件，扩展成「全量请求/响应录制」即可。
  - 存储格式建议 HAR + DOM snapshot zip。
- **杠杆评估**：⭐⭐⭐⭐  
  - 这是「自动化采集」类产品的差异化能力，量化分析师 / 数据团队会非常看重。
  - 建议作为 A/B 之后的下一波。

---

### 2.6 方向 F — 本地 LLM Provider（Ollama / llama.cpp）

在 `LLMProvider` 层增加本地模型 provider，让 AI 助手可以完全离线运行。

- **场景**：隐私敏感任务、内网环境、按 token 付费成本敏感的场景。
- **改造抓手**：现有 `LLMProvider` 是接口式封装，新增一个 `OllamaProvider` 即可。
- **杠杆评估**：⭐⭐⭐  
  - 工作量极小（1-2 天），是低成本扩大用户群体的小杠杆。
  - 不必单独立 spec，建议作为 [specs/v1.1-enhancements.md](../specs/v1.1-enhancements.md) 的一项增量。

---

## 3. 评估矩阵

| 方向 | 用户价值 | 工作量 | 与主线冲突 | 是否前置依赖 | 建议优先级 |
| --- | --- | --- | --- | --- | --- |
| A · Headless Runner | 高 | 中 | 低（解耦不破坏主线） | C/D/E 的前置 | **P0**（副线主推） |
| B · Task-as-Code | 中-高 | 低 | 无 | 团队协作前置 | **P0**（小杠杆先做） |
| C · MCP 集成 | 高 | 中 | 无 | 依赖 ToolRegistry 稳定 | **P1** |
| D · 数据出口/可观测性 | 中（专业用户高） | 中 | 无 | 依赖 A | P2 |
| E · Snapshot Replay | 高（差异化） | 中 | 无 | 与 RecorderPanel 协同 | P1 |
| F · 本地 LLM Provider | 中 | 低 | 无 | 无 | P2（增量并入 v1.1） |

---

## 4. 推荐路线组合

不要同时启动 6 个方向。推荐两种打法二选一：

### 4.1 打法一：稳健优先（推荐）

保持 [overview/roadmap.md](../overview/roadmap.md) 的主线为主，副线**只插入两件小事**：

1. **B（Task-as-Code）** —— 1-2 周可完成，立即提升任务的可维护性和团队协作雏形。
2. **F（本地 LLM Provider）** —— 几天工作量，扩大 AI 助手适用场景。

主线完成 M3（结果与日志中心）后，再启动 **A（Headless Runner）**，为后续生态铺路。

### 4.2 打法二：生态优先

在主线 M2 完成（任务调度可用）后，**优先启动 A + C 的组合**：

1. **A（Headless Runner）** —— 把引擎解耦，准备暴露给外部。
2. **C（MCP 集成）** —— 把 YClaw 接入主流 AI 客户端，借生态曝光。
3. **E（Snapshot Replay）** —— 沉淀「调试 / 回归」差异化能力。

适合「想尽快让 YClaw 被外部生态看见」的策略。

---

## 5. 与主线的协作约束

- 副线方向 **不应抢占** 主线 M0-M3 的工程资源；建议串行而非并行。
- 任何副线方向落地前，必须确认它 **不会破坏** 现有 IPC、插件、AI 工具的稳定边界。
- 副线落地的代码尽量走「新增模块 + 接口扩展」，避免改动核心服务的内部结构。

---

## 6. 状态跟踪

| 方向 | 状态 | 关联文档 |
| --- | --- | --- |
| A · Headless Runner | 草案 / HR-M1 CLI 起步 + adapter 基础版 | [specs/headless-runner-v1.md](../specs/headless-runner-v1.md) |
| B · Task-as-Code | 实施中（核心层已落地） | [specs/task-as-code-v1.md](../specs/task-as-code-v1.md) |
| C · MCP 集成 | 实施中（Server + Client 主链路已落地） | [specs/mcp-integration-v1.md](../specs/mcp-integration-v1.md) |
| D · 数据出口/可观测性 | 仅本文档 | — |
| E · Snapshot Replay | 仅本文档 | — |
| F · 本地 LLM Provider | 仅本文档（建议并入 v1.1 增量） | — |
