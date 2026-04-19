# YClaw 自动化主线近期执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在未来 2-4 周内，把 YClaw 从“多模块骨架 + 部分闭环”推进到“自动化采集主链路稳定可用、结果可追溯、浏览器介入路径明确”的可交付阶段。

**Architecture:** 先修复实现与文档偏差，再围绕自动化产品主线分三段推进：任务与调度底座、结果与日志闭环、浏览器介入最小可用版。AI 与插件继续保留入口，但近期只补最小支撑，不抢自动化主线资源。

**Tech Stack:** Electron 33、React 18、Vite 6、TypeScript 5.7、better-sqlite3、Vitest、Ant Design 5

---

## 范围与节奏

| 阶段 | 时间 | 目标 | 验收结果 |
| --- | --- | --- | --- |
| Stage 0 | 第 1 周 | 修正实现缺口与文档状态偏差 | 关键 IPC、AI、任务、浏览器、插件状态可验证 |
| Stage 1 | 第 1-2 周 | 跑通任务、批次、调度、执行底座 | 任务可创建、执行、暂停、恢复、复跑 |
| Stage 2 | 第 2-3 周 | 补齐结果、日志、导出、错误定位 | 结果与失败原因可查可导出 |
| Stage 3 | 第 3-4 周 | 明确并落地浏览器介入最小闭环 | 失败现场可观察、会话信息可见、路线不再模糊 |

## 文件映射

| 区域 | 文件 |
| --- | --- |
| 主进程装配 | `src/main/app.ts`, `src/shared/constants/channels.ts`, `src/main/ipc/IpcController.ts` |
| 自动化域 | `src/main/services/TaskService.ts`, `src/engines/automation/FlowRunner.ts`, `src/engines/automation/AutomationEngine.ts`, `src/shared/types/task.ts` |
| 数据层 | `src/main/services/DatabaseService.ts`, `src/main/services/LogService.ts` |
| 浏览器 | `src/main/browser/TabManager.ts`, `src/renderer/entries/browser/App.tsx`, `src/renderer/entries/browser/components/WebViewContainer.tsx`, `src/shared/types/browser.ts` |
| AI 最小支撑 | `src/main/ai/AIService.ts`, `src/main/ai/ContextManager.ts`, `src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx`, `src/shared/types/ai.ts` |
| 自动化 UI | `src/renderer/entries/automation/App.tsx`, `src/renderer/entries/automation/components/TaskList.tsx`, `src/renderer/entries/automation/components/ExecutionPanel.tsx` |
| 测试 | `tests/unit/services/AppIpcIntegration.test.ts`, `tests/unit/services/TaskService.test.ts`, `tests/unit/engines/FlowRunner.test.ts`, `tests/unit/services/AIService.test.ts`, `tests/unit/services/TabManager.test.ts`, `tests/unit/components/WebViewContainer.test.tsx` |
| 文档 | `docs/overview/roadmap.md`, `docs/specs/v1.0-baseline.md`, `docs/specs/v1.1-enhancements.md`, `docs/plans/automation-browser-ops-v1.md`, `README.md` |

## 执行原则

| 原则 | 落地方式 |
| --- | --- |
| TDD | 每个任务先写失败测试，再做最小实现，再跑定向测试。 |
| 先闭环再扩展 | 先打通任务/调度/结果/介入链路，再做模板、AI 主动智能、市场生态。 |
| 文档与实现同步 | 每完成一个阶段，回写 `✅ / 🟡 / ⬜` 状态，禁止继续让文档领先代码。 |
| 最小可交付 | 浏览器模块与 AI 助手都优先做“够用且真实”，不做表面展示型能力。 |

### Task 1: 校准实现状态并补齐关键通道

**Files:**
- Modify: `src/main/app.ts`
- Modify: `src/shared/constants/channels.ts`
- Modify: `src/main/ai/AIService.ts`
- Test: `tests/unit/services/AppIpcIntegration.test.ts`
- Test: `tests/unit/services/AIService.test.ts`
- Modify: `docs/specs/v1.0-baseline.md`
- Modify: `docs/specs/v1.1-enhancements.md`

- [ ] **Step 1: 写失败测试，锁定当前真正缺口**

覆盖以下断言：
- `ai:chat`、`plugin:list`、`task:list`、`stock:data` 在应用启动后可用
- `ai:chat` 返回统一错误结构，而不是渲染端无限等待
- 文档中标记为 `✅` 的能力至少有基础测试覆盖

- [ ] **Step 2: 运行定向测试确认失败**

Run: `npx vitest run tests/unit/services/AppIpcIntegration.test.ts tests/unit/services/AIService.test.ts`

Expected:
- FAIL，至少出现通道未注册、依赖未装配或行为与文档不一致的问题

- [ ] **Step 3: 在 `src/main/app.ts` 中补齐近期必须存在的服务装配**

最低接入：
- `AIService`
- `TaskService`
- `DataSourceManager`
- `PluginLoader`
- `PermissionChecker`

约束：
- 优先复用现有类
- 不继续把兜底逻辑堆到 renderer

- [ ] **Step 4: 校正文档状态**

将以下文档项按真实实现改为 `✅ / 🟡 / ⬜`：
- `docs/specs/v1.0-baseline.md`
- `docs/specs/v1.1-enhancements.md`

要求：
- 不保留无法通过最小测试验证的 `✅`
- 对浏览器、AI、插件等半闭环能力统一降级为 `🟡`

- [ ] **Step 5: 重新运行定向测试**

Run: `npx vitest run tests/unit/services/AppIpcIntegration.test.ts tests/unit/services/AIService.test.ts`

Expected:
- PASS

- [ ] **Step 6: 提交**

```bash
git add src/main/app.ts src/shared/constants/channels.ts src/main/ai/AIService.ts tests/unit/services/AppIpcIntegration.test.ts tests/unit/services/AIService.test.ts docs/specs/v1.0-baseline.md docs/specs/v1.1-enhancements.md
git commit -m "fix: align runtime channels with documented status"
```

### Task 2: 打通任务、批次与调度底座

**Files:**
- Modify: `src/main/services/TaskService.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/engines/automation/FlowRunner.ts`
- Modify: `src/shared/types/task.ts`
- Modify: `src/renderer/entries/automation/App.tsx`
- Modify: `src/renderer/entries/automation/components/TaskList.tsx`
- Modify: `src/renderer/entries/automation/components/ExecutionPanel.tsx`
- Test: `tests/unit/services/TaskService.test.ts`
- Test: `tests/unit/engines/FlowRunner.test.ts`

- [ ] **Step 1: 先写失败测试**

覆盖以下断言：
- `task:list` 可读取任务摘要
- `task:start/pause/resume/stop` 能驱动 `FlowRunner`
- 运行中的任务状态会回写数据库或内存运行态
- renderer 读取的任务状态来自 IPC，而不是本地伪状态

- [ ] **Step 2: 运行定向测试**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/engines/FlowRunner.test.ts`

Expected:
- FAIL，暴露任务状态、运行协调或执行记录不完整的问题

- [ ] **Step 3: 收敛任务服务边界**

在 `src/main/services/TaskService.ts` 保持单一职责：
- 读取/写入任务与批次摘要
- 持有运行中的 `FlowRunner`
- 负责状态迁移与 EventBus 通知

不要：
- 在 renderer 中模拟运行状态
- 让 `FlowRunner` 直接承担 UI 状态职责

- [ ] **Step 4: 让自动化页面改用真实状态源**

在以下文件移除“演示态”依赖：
- `src/renderer/entries/automation/App.tsx`
- `src/renderer/entries/automation/components/TaskList.tsx`
- `src/renderer/entries/automation/components/ExecutionPanel.tsx`

最低要求：
- 首屏能加载任务列表
- 点击任务后能看到执行状态
- 状态变更来自 IPC/事件而非本地写死数据

- [ ] **Step 5: 重新运行定向测试**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/engines/FlowRunner.test.ts tests/unit/services/AppIpcIntegration.test.ts`

Expected:
- PASS

- [ ] **Step 6: 运行阶段门禁**

Run: `npm run lint && npm run typecheck`

Expected:
- lint 通过
- typecheck 通过

- [ ] **Step 7: 提交**

```bash
git add src/main/services/TaskService.ts src/main/services/DatabaseService.ts src/engines/automation/FlowRunner.ts src/shared/types/task.ts src/renderer/entries/automation/App.tsx src/renderer/entries/automation/components/TaskList.tsx src/renderer/entries/automation/components/ExecutionPanel.tsx tests/unit/services/TaskService.test.ts tests/unit/engines/FlowRunner.test.ts
git commit -m "feat: complete task and scheduler runtime baseline"
```

### Task 3: 建立结果、日志与失败定位闭环

**Files:**
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/LogService.ts`
- Modify: `src/engines/automation/FlowRunner.ts`
- Modify: `src/renderer/entries/automation/components/ExecutionPanel.tsx`
- Modify: `src/shared/types/task.ts`
- Test: `tests/unit/services/TaskService.test.ts`
- Test: `tests/unit/engines/FlowRunner.test.ts`
- Optional Test: `tests/unit/components/ExecutionPanel.test.tsx`

- [ ] **Step 1: 写失败测试，覆盖结果追溯链路**

覆盖以下断言：
- 每次执行都有批次记录
- 失败步骤可关联日志与截图元数据
- 结果列表/执行面板能看到最近执行状态
- 导出所需数据字段完整

- [ ] **Step 2: 运行定向测试**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/engines/FlowRunner.test.ts tests/unit/components/ExecutionPanel.test.tsx`

Expected:
- FAIL，显示结果记录、执行日志或 UI 展示缺失

- [ ] **Step 3: 扩展数据模型，但只做近期必需字段**

近期必需：
- `task_batches`
- `execution_logs`
- 结果记录与截图路径关联字段

近期不做：
- 复杂报表聚合
- AI 训练类埋点
- 多维分析索引

- [ ] **Step 4: 在执行链路中写入结构化日志**

要求：
- `FlowRunner` 在步骤开始、成功、失败、重试、暂停时都写事件
- `LogService` 继续负责文件日志
- `DatabaseService` 负责结构化查询数据

- [ ] **Step 5: 在执行面板暴露真实可观察信息**

最低显示：
- 当前任务状态
- 最近批次结果
- 最近失败原因
- 关键步骤时间线

- [ ] **Step 6: 重新运行定向测试**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/engines/FlowRunner.test.ts tests/unit/components/ExecutionPanel.test.tsx`

Expected:
- PASS

- [ ] **Step 7: 提交**

```bash
git add src/main/services/DatabaseService.ts src/main/services/LogService.ts src/engines/automation/FlowRunner.ts src/renderer/entries/automation/components/ExecutionPanel.tsx src/shared/types/task.ts tests/unit/services/TaskService.test.ts tests/unit/engines/FlowRunner.test.ts tests/unit/components/ExecutionPanel.test.tsx
git commit -m "feat: add observable execution results and logs"
```

### Task 4: 明确浏览器模块路线并交付最小可用版

**Files:**
- Modify: `src/main/browser/TabManager.ts`
- Modify: `src/shared/types/browser.ts`
- Modify: `src/renderer/entries/browser/App.tsx`
- Modify: `src/renderer/entries/browser/components/WebViewContainer.tsx`
- Test: `tests/unit/services/TabManager.test.ts`
- Test: `tests/unit/components/WebViewContainer.test.tsx`
- Modify: `docs/plans/automation-browser-ops-v1.md`
- Modify: `README.md`

- [ ] **Step 1: 写失败测试，先锁定用户可见缺口**

覆盖以下断言：
- 浏览器页不再展示“后续接入”的主文案
- 标签状态含 `canGoBack`、`canGoForward`、`sessionId`
- 页面能显示当前 session/partition 信息

- [ ] **Step 2: 运行定向测试**

Run: `npx vitest run tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx`

Expected:
- FAIL，说明容器仍是占位壳或状态字段不足

- [ ] **Step 3: 在实现上做明确二选一决策**

仅允许以下一种：
- 方案 A：真实接入 `WebContentsView`
- 方案 B：短期降级为“浏览器会话控制台”，但必须把文档与 UI 文案同步修正

决策规则：
- 若本轮目标是快速交付近期版本，先执行 B
- 若本轮目标是兑现原始浏览器 SPEC，执行 A

- [ ] **Step 4: 完成会话可见性最小闭环**

最低要求：
- 可为标签创建/显示 partition
- 页面可显示当前会话 ID
- 自动化侧后续可引用该会话信息

- [ ] **Step 5: 同步回写文档**

更新：
- `docs/plans/automation-browser-ops-v1.md`
- `README.md`

要求：
- 若未真实接入浏览器容器，文档不得继续宣称已完整支持真实内嵌浏览器

- [ ] **Step 6: 重新运行定向测试**

Run: `npx vitest run tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx`

Expected:
- PASS

- [ ] **Step 7: 提交**

```bash
git add src/main/browser/TabManager.ts src/shared/types/browser.ts src/renderer/entries/browser/App.tsx src/renderer/entries/browser/components/WebViewContainer.tsx tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx docs/plans/automation-browser-ops-v1.md README.md
git commit -m "feat: clarify browser intervention runtime path"
```

### Task 5: AI 助手只补自动化主线所需最小支撑

**Files:**
- Modify: `src/main/ai/ContextManager.ts`
- Modify: `src/main/ai/AIService.ts`
- Modify: `src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx`
- Modify: `src/shared/types/ai.ts`
- Test: `tests/unit/services/ContextManager.test.ts`
- Test: `tests/unit/services/AIService.test.ts`

- [ ] **Step 1: 写失败测试，限定 AI 近期职责**

覆盖以下断言：
- AI 能返回最近任务、任务状态、系统状态
- AI 失败时能区分未配置、Provider 错误、网络错误
- ContextManager 返回真实任务/模块上下文，而不是空数组占位

- [ ] **Step 2: 运行定向测试**

Run: `npx vitest run tests/unit/services/ContextManager.test.ts tests/unit/services/AIService.test.ts`

Expected:
- FAIL，说明上下文或错误分流不足

- [ ] **Step 3: 收敛 AI 的近期能力边界**

近期仅支持：
- 任务状态查询
- 系统状态查询
- 模块导航
- 自动化失败原因解释

近期不做：
- 主动晨报
- 自动执行高风险写操作
- 大规模工具编排

- [ ] **Step 4: 更新 AI 聊天面板文案与失败态**

在 `src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx`：
- 显示配置缺失提示
- 显示 provider/network 错误分流
- 避免把任何失败都表现为“空响应”

- [ ] **Step 5: 重新运行定向测试**

Run: `npx vitest run tests/unit/services/ContextManager.test.ts tests/unit/services/AIService.test.ts`

Expected:
- PASS

- [ ] **Step 6: 提交**

```bash
git add src/main/ai/ContextManager.ts src/main/ai/AIService.ts src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx src/shared/types/ai.ts tests/unit/services/ContextManager.test.ts tests/unit/services/AIService.test.ts
git commit -m "feat: focus ai assistant on automation support"
```

### Task 6: 阶段收尾与质量门禁

**Files:**
- Modify: `docs/overview/roadmap.md`
- Modify: `docs/specs/v1.0-baseline.md`
- Modify: `docs/specs/v1.1-enhancements.md`
- Modify: `README.md`
- Test: `tests/unit/components/BrowserApp.regression.test.tsx`
- Test: `tests/unit/components/LoadingRegression.test.tsx`

- [ ] **Step 1: 回写阶段完成情况**

更新文档中的以下维度：
- 已闭环
- 部分实现
- 已延期/已降级

- [ ] **Step 2: 清理最低限度 warning 与回归项**

至少确认：
- 浏览器回归测试仍通过
- Loading 回归测试仍通过
- 不新增明显 lint/typecheck warning

- [ ] **Step 3: 运行全量质量门禁**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

Expected:
- lint 通过
- typecheck 通过
- test 完整返回
- build 通过

- [ ] **Step 4: 提交**

```bash
git add docs/overview/roadmap.md docs/specs/v1.0-baseline.md docs/specs/v1.1-enhancements.md README.md tests/unit/components/BrowserApp.regression.test.tsx tests/unit/components/LoadingRegression.test.tsx
git commit -m "docs: close near-term automation milestone status"
```

## 推荐执行顺序

| 顺序 | 任务 | 原因 |
| --- | --- | --- |
| 1 | Task 1 | 先统一真实状态与关键通道，避免后续建立在错误假设上。 |
| 2 | Task 2 | 自动化主线的运行底座优先级最高。 |
| 3 | Task 3 | 没有结果和日志，就没有可交付的采集产品。 |
| 4 | Task 4 | 浏览器路线必须在主链路跑通后尽快定案。 |
| 5 | Task 5 | AI 只做增效层，不能抢占底层闭环资源。 |
| 6 | Task 6 | 最后统一质量门禁和文档状态。 |

## 完成定义

| 类别 | 完成标准 |
| --- | --- |
| 自动化主链路 | 任务创建、启动、暂停、恢复、复跑可用。 |
| 可观察性 | 每个批次可关联结果、日志、错误、截图元数据。 |
| 浏览器路径 | 用户和文档都能清楚知道浏览器模块当前是否为真实容器或控制台方案。 |
| AI 辅助 | AI 能回答任务与系统状态，并解释基础失败原因。 |
| 工程质量 | `lint`、`typecheck`、`test`、`build` 全通过。 |

## 风险提示

| 风险 | 处理方式 |
| --- | --- |
| 浏览器真实接入 `WebContentsView` 牵动面较大 | 若时间紧，先降级为会话控制台并回写文档。 |
| AI 能力扩张过快挤压主线开发 | 把 AI 严格限制在“自动化助理”边界内。 |
| 文档继续领先实现 | 每个任务结束后立刻回写状态，避免再次累积偏差。 |
| 全量测试耗时较长 | 先跑定向测试，再在 Task 6 跑全量门禁。 |

