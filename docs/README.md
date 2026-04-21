# 📚 YClaw 文档中心

本目录是 YClaw 项目的所有文档入口。文档已按 **目的（What for）** 分类，请遵循下面的目录公约存放新文档，避免回到“扁平堆放”的状态。

> 第一次进入仓库？建议阅读顺序：[根目录 README](../README.md) → [overview/current-status.md](overview/current-status.md) → [architecture/architecture.md](architecture/architecture.md)。

---

## 1. 目录结构与定位

| 目录 | 定位 | 何时往里写 | 命名规范 |
| --- | --- | --- | --- |
| [`overview/`](overview/) | 项目当下的整体视图 | 描述「现在到了哪」「下一步往哪走」 | `current-status.md`、`roadmap.md` 等少量稳定文件，原地更新而非新增 |
| [`product/`](product/) | 产品定义与长期规划 | 产品愿景、角色场景、长期可行性分析 | `prd.md`、`plan.md` 等长期稳定文件 |
| [`architecture/`](architecture/) | 架构与代码结构 | 介绍技术分层、调用链、目录职责 | `architecture.md`、`structure.md`，按主题命名 |
| [`specs/`](specs/) | 验收级规格 | 一个版本或专项的「要交付什么、验收标准」 | `v1.0-baseline.md`、`v1.1-enhancements.md`、`<专项>-v<N>.md` |
| [`design/`](design/) | 设计草案与方案建议 | 早于 spec 的设计探索、模块/页面优化建议 | `<主题>.md`，例如 `ai-assistant.md`、`page-container-optimization.md` |
| [`plans/`](plans/) | 命名实施计划 | 把 spec 拆成阶段/里程碑的实施路线 | `<主题>-v<N>.md`，例：`automation-browser-ops-v1.md` |
| [`reviews/`](reviews/) | 评审报告与修复记录 | 代码评审、PR 分析、未提交改动审查、修复回写 | `<主题>.md` 或带日期 `YYYY-MM-DD-<主题>.md` |
| [`superpowers/`](superpowers/) | Agent 工作流过程产物 | 由 superpowers/agent 生成的 specs / plans / reviews | 内部已分 `specs/`、`plans/`、`reviews/`，命名带日期 |

> ⚠️ **不要在 `docs/` 根目录新增文档**。根目录只保留本 `README.md`。所有新文档必须落到上述子目录之一。

---

## 2. 入口文档导航

### 2.1 我想快速了解项目

| 我是谁 | 阅读路径 |
| --- | --- |
| 第一次进入仓库 | [根目录 README](../README.md) → [overview/current-status.md](overview/current-status.md) |
| 准备开发 | [overview/current-status.md](overview/current-status.md) → [architecture/structure.md](architecture/structure.md) → [architecture/architecture.md](architecture/architecture.md) |
| 想了解产品定位 | [product/prd.md](product/prd.md) → [product/plan.md](product/plan.md) → [overview/roadmap.md](overview/roadmap.md) |
| 想了解 V1 要交付什么 | [specs/v1.0-baseline.md](specs/v1.0-baseline.md) → [specs/v1.1-enhancements.md](specs/v1.1-enhancements.md) |
| 想了解自动化主路线 | [specs/automation-browser-ops-v1.md](specs/automation-browser-ops-v1.md) → [plans/automation-browser-ops-v1.md](plans/automation-browser-ops-v1.md) |
| 想了解 Runner 主线 | [specs/remote-runner-control-plane-v1.md](specs/remote-runner-control-plane-v1.md) → [specs/capacity-aware-runner-scheduler-v1.md](specs/capacity-aware-runner-scheduler-v1.md) |

### 2.2 现状与规划（overview / product）

- [overview/current-status.md](overview/current-status.md)：当前实现现状与已知限制
- [overview/roadmap.md](overview/roadmap.md)：后续拓展方向与近期主路线
- [product/prd.md](product/prd.md)：产品愿景、角色与场景
- [product/plan.md](product/plan.md)：可行性分析与阶段计划

### 2.3 架构与代码结构（architecture）

- [architecture/architecture.md](architecture/architecture.md)：进程模型、分层、调用链
- [architecture/structure.md](architecture/structure.md)：实际目录结构与模块职责

### 2.4 规格与实施（specs / plans）

- [specs/v1.0-baseline.md](specs/v1.0-baseline.md)：V1.0 基线规格
- [specs/v1.1-enhancements.md](specs/v1.1-enhancements.md)：V1.1 增强规格
- [specs/automation-browser-ops-v1.md](specs/automation-browser-ops-v1.md)：自动化采集 V1 规格
- [specs/headless-runner-v1.md](specs/headless-runner-v1.md)：Headless Runner / CLI V1 规格
- [specs/remote-runner-control-plane-v1.md](specs/remote-runner-control-plane-v1.md)：Remote Runner 控制面 V1 规格
- [specs/capacity-aware-runner-scheduler-v1.md](specs/capacity-aware-runner-scheduler-v1.md)：容量感知 Runner 调度器 V1 规格
- [specs/task-as-code-v1.md](specs/task-as-code-v1.md)：任务即代码 V1 规格
- [specs/mcp-integration-v1.md](specs/mcp-integration-v1.md)：MCP 集成 V1 规格
- [plans/automation-browser-ops-v1.md](plans/automation-browser-ops-v1.md)：自动化采集 V1 实施计划
- [superpowers/plans/2026-04-20-remote-runner-control-plane-v1.md](superpowers/plans/2026-04-20-remote-runner-control-plane-v1.md)：Remote Runner 控制面 V1 agent 实施拆解
- [superpowers/plans/2026-04-21-capacity-aware-runner-scheduler-v1.md](superpowers/plans/2026-04-21-capacity-aware-runner-scheduler-v1.md)：容量感知 Runner 调度器 V1 agent 实施拆解

### 2.5 设计与专项（design）

- [design/next-phase-ideas.md](design/next-phase-ideas.md)：下一阶段拓展思路（产品形态升维副线）
- [design/ai-assistant.md](design/ai-assistant.md)：AI 运营助手设计方案
- [design/dashboard-ideas.md](design/dashboard-ideas.md)：总控页面创意建议
- [design/page-container-optimization.md](design/page-container-optimization.md)：页面容器优化建议
- [design/package-size-optimization.md](design/package-size-optimization.md)：包体积优化方案

### 2.6 评审与修复记录（reviews）

- [reviews/code-review-remediation-list.md](reviews/code-review-remediation-list.md)：历史评审修复清单
- [reviews/automation-browser-ops-v1.md](reviews/automation-browser-ops-v1.md)：自动化采集 V1 代码评审
- [reviews/2026-04-20-task-as-code-review.md](reviews/2026-04-20-task-as-code-review.md)：Task-as-Code 代码评审记录
- [reviews/pr16-analysis.md](reviews/pr16-analysis.md)、[reviews/pr16-second-review.md](reviews/pr16-second-review.md)：PR16 评审
- [reviews/2026-04-17-uncommitted-review.md](reviews/2026-04-17-uncommitted-review.md)、[reviews/2026-04-17-uncommitted-fix.md](reviews/2026-04-17-uncommitted-fix.md)：2026-04-17 未提交改动审查与修复
- [reviews/2026-04-17-package-size-optimization-record.md](reviews/2026-04-17-package-size-optimization-record.md)：2026-04-17 包体优化落地记录

### 2.7 Agent 过程产物（superpowers）

- [superpowers/specs/](superpowers/specs/)：agent 输出的设计规格
- [superpowers/plans/](superpowers/plans/)：agent 输出的实施计划
- [superpowers/reviews/](superpowers/reviews/)：agent 评审模板与材料

---

## 3. 新增文档时的判断流程

> 给开发者与 Agent 的统一规范：动手前先按下表对号入座，再决定文件落在哪。

```
我要写的是…
├── 「现在做到哪了 / 接下来要做什么」     → overview/
├── 「为什么做这个 / 长期形态」           → product/
├── 「系统是怎么工作的 / 代码长什么样」   → architecture/
├── 「这个版本 / 专项要交付什么、如何验收」→ specs/
├── 「某个模块或页面的设计探索 / 改造建议」→ design/
├── 「如何把 spec 拆成阶段执行」          → plans/
├── 「评审 / 审查 / 修复回写」            → reviews/
└── 「agent 自动产出的 spec/plan/review」 → superpowers/<子目录>/
```

辅助规则：

- 一个文档只能属于一个目录。如果你纠结放哪，说明它包含了多种目的，**应当拆分**而不是放进根目录。
- 命名一律小写、英文、`-` 连字符；带日期前缀 `YYYY-MM-DD-` 的文档仅用于 `reviews/` 与 `superpowers/`。
- spec / plan / review 之间用「同名」串联：例如 `specs/automation-browser-ops-v1.md` ↔ `plans/automation-browser-ops-v1.md` ↔ `reviews/automation-browser-ops-v1.md`，便于检索。
- 评审报告完成修复后，请把结论 **写回到对应的 spec / plan**，避免事实分散在多个文档。
- 长期稳定的事实（架构、目录结构、产品定义）**就地更新**，不要为每次小修订新增日期版本。
- 历史性快照请放进 `reviews/` 并使用日期前缀，避免污染 `overview/`、`product/`、`specs/`、`plans/`。

---

## 4. 文档健康度自查清单

提交涉及 `docs/` 的 PR 前，请快速核对：

- [ ] 新增文档落在子目录，而不是 `docs/` 根目录
- [ ] 文件名遵守「小写 + 连字符」规范
- [ ] 已在本 README 的 §2 入口导航中补一行链接（仅当该文档是入口性质时）
- [ ] 改名或移动文档时，已搜索并更新仓库内引用（`rg "docs/<old-path>"`）
- [ ] 评审报告中的结论已经回写到对应 spec / plan，避免重复维护
