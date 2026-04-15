# Automation Browser Ops V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full V1 automation-collection product loop for YClaw: task definition, scheduling, result storage, browser intervention, recorder/templates, session management, alerts, and acceptance coverage.

**Architecture:** Extend the current Electron main-process services instead of creating a parallel subsystem. Keep task execution centered on `TaskService` + `FlowRunner` + `TabManager`, then layer product-level capabilities through focused services for scheduling, batches, results, sessions, intervention, templates, and structured execution logs. Renderer work stays split by entry: `automation` owns task/result operations, `browser` owns intervention/observation, shared hooks/components remain in `src/renderer/shared`.

**Tech Stack:** Electron 33, React 18, Vite 6, TypeScript 5.7, better-sqlite3, Vitest 2, Playwright 1.49, Zustand, zod

> **现有代码库须知：**
>
> - IPC 常量定义在 `src/shared/constants/channels.ts`（`IPC_CHANNELS` 对象），主进程侧类型在 `src/main/ipc/channels.ts`（`IpcHandler` / `IpcChannelDefinition`）
> - IPC handler 通过 `IpcController.handle(channel, handler)` 注册（包装 `ipcMain.handle`），当前无 schema 校验
> - 浏览器类型在 `src/shared/types/browser.ts`（仅 `Tab` 接口），需扩展介入/会话类型
> - 渲染进程 IPC 通过 `src/renderer/shared/hooks/useIpc.ts` 的 `useIpc()` / `useIpcEvent()` 调用
> - `SelectorGenerator` 仅有 `generateFromPoint(wc, x, y)` 和 `validate(wc, selector)` 两个方法
> - E2E 目录 `tests/e2e/` 尚未创建，但 `package.json` 已配置 `test:e2e: "playwright test"`
> - `npm run typecheck` = `tsc --noEmit`

---

## Scope and sequencing

| Phase   | Covers                                                 | Outcome                     |
| ------- | ------------------------------------------------------ | --------------------------- |
| Phase A | Task domain + scheduler + batches (SPEC-A01, A02)      | 自动化主链路可运行          |
| Phase B | Results + execution logs + export (SPEC-A05, A07 部分) | 结果可看、可查、可复跑      |
| Phase C | Browser intervention + session binding (SPEC-A03, A06) | 失败可接管、可恢复          |
| Phase D | Recorder + extraction templates (SPEC-A04)             | 配置效率提升，摆脱手工 JSON |
| Phase E | Alerts + acceptance + docs (SPEC-A07 剩余, A08)        | 形成可交付的一期产品        |

> 实施顺序是“全量计划”，不是只做 Phase A；但执行时仍按 Phase A → E 逐步推进，避免范围失控。

## File map

### Main process services

| File                                       | Action | Responsibility                                 |
| ------------------------------------------ | ------ | ---------------------------------------------- |
| `src/main/services/TaskService.ts`         | Modify | 扩展任务 CRUD、批次视图、复跑入口              |
| `src/main/services/DatabaseService.ts`     | Modify | 增加表迁移、查询封装、初始化新表               |
| `src/main/services/index.ts`               | Modify | 导出新增服务                                   |
| `src/main/services/SchedulerService.ts`    | Create | 管理 cron 调度、并发、队列、进程重启恢复       |
| `src/main/services/BatchService.ts`        | Create | 管理 `task_batches` 生命周期、断点与状态流转   |
| `src/main/services/ResultService.ts`       | Create | 管理 `extraction_results` 查询、导出、可疑标记 |
| `src/main/services/ExecutionLogService.ts` | Create | 写入/查询 `execution_logs` 结构化日志          |
| `src/main/services/SessionRegistry.ts`     | Create | 管理会话容器元数据与绑定                       |
| `src/main/services/TemplateService.ts`     | Create | 管理提取模板 CRUD                              |
| `src/main/services/AlertService.ts`        | Create | 聚合错误日志并推送告警                         |

### Engines and browser

| File                                         | Action | Responsibility                                        |
| -------------------------------------------- | ------ | ----------------------------------------------------- |
| `src/engines/automation/FlowRunner.ts`       | Modify | 断点持久化、resume 协议、逐步结构化日志               |
| `src/engines/automation/AutomationEngine.ts` | Modify | 提取结果直接入库、登录失效识别钩子                    |
| `src/engines/automation/types.ts`            | Modify | 扩展 `StepResult`、`Breakpoint`、`ExecutionContext`   |
| `src/main/browser/TabManager.ts`             | Modify | 支持按 `sessionPartition` 复用/恢复 tab，会话绑定查询 |
| `src/main/browser/index.ts`                  | Modify | 导出新增 browser API                                  |

### IPC and shared contracts

| File                               | Action | Responsibility                                                               |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `src/shared/constants/channels.ts` | Modify | 补全 task/batch/result/session/template/intervention/alert 通道常量          |
| `src/shared/types/task.ts`         | Modify | 扩展任务、批次、调度配置、步骤结果类型                                       |
| `src/shared/types/browser.ts`      | Modify | 在现有 `Tab` 接口基础上增加介入台状态、会话关联类型                          |
| `src/shared/types/ipc.ts`          | Modify | 为新增 IPC 响应与 payload 建类型                                             |
| `src/shared/types/index.ts`        | Modify | 统一导出新增类型                                                             |
| `src/main/ipc/IpcController.ts`    | Modify | 注册新增 IPC handler（通过 `controller.handle()` 方法）                      |
| `src/main/ipc/channels.ts`         | Modify | 如需扩展 `IpcChannelDefinition`，在此增加类型                                |
| `src/main/app.ts`                  | Modify | 在 IPC 注册区块补全新 handler（现有模式：直接在 app.ts 中 `ipcMain.handle`） |

### Renderer

| File                                                             | Action | Responsibility                      |
| ---------------------------------------------------------------- | ------ | ----------------------------------- |
| `src/renderer/entries/automation/App.tsx`                        | Modify | 承载任务中心、批次、结果中心主布局  |
| `src/renderer/entries/automation/components/TaskList.tsx`        | Modify | 任务列表、启停、复跑、状态摘要      |
| `src/renderer/entries/automation/components/StepEditor.tsx`      | Modify | 从手工 JSON 过渡到模板/录制数据编辑 |
| `src/renderer/entries/automation/components/ExecutionPanel.tsx`  | Modify | 批次详情、执行日志、失败复跑        |
| `src/renderer/entries/automation/components/BatchList.tsx`       | Create | 展示批次列表与状态筛选              |
| `src/renderer/entries/automation/components/ResultTable.tsx`     | Create | 展示结果列表、详情、导出            |
| `src/renderer/entries/automation/components/TemplateManager.tsx` | Create | 提取模板列表、编辑、绑定            |
| `src/renderer/entries/browser/App.tsx`                           | Modify | 浏览器介入台主入口                  |
| `src/renderer/entries/browser/components/WebViewContainer.tsx`   | Modify | 观察/介入状态展示                   |
| `src/renderer/entries/browser/components/InterventionPanel.tsx`  | Create | 当前步骤、错误、恢复执行            |
| `src/renderer/entries/browser/components/RecorderPanel.tsx`      | Create | 录制操作流与字段提取面板            |
| `src/renderer/shared/hooks/useIpc.ts`                            | Modify | 暴露新增 IPC 包装器                 |

### Tests

| File                                               | Action | Responsibility                                       |
| -------------------------------------------------- | ------ | ---------------------------------------------------- |
| `tests/unit/services/TaskService.test.ts`          | Modify | 任务扩展字段、批次视图、复跑                         |
| `tests/unit/services/TabManager.test.ts`           | Modify | 会话绑定、介入恢复场景                               |
| `tests/unit/services/IpcController.test.ts`        | Modify | 新 IPC 通道注册与校验                                |
| `tests/unit/services/AppIpcIntegration.test.ts`    | Modify | 自动化主链路 IPC 集成（已有文件，扩展 handler mock） |
| `tests/unit/engines/FlowRunner.test.ts`            | Modify | 断点持久化、恢复执行、结构化日志                     |
| `tests/unit/engines/AutomationEngine.test.ts`      | Modify | 结果入库、登录失效识别                               |
| `tests/unit/components/ExecutionPanel.test.tsx`    | Modify | 批次日志与复跑 UI                                    |
| `tests/unit/components/WebViewContainer.test.tsx`  | Modify | 介入态显示与恢复动作（已有回归测试，扩展介入场景）   |
| `tests/unit/components/StepEditor.test.tsx`        | Modify | 模板/录制数据编辑                                    |
| `tests/unit/components/TaskList.test.tsx`          | Create | 任务状态、启停、复跑（当前不存在）                   |
| `tests/unit/components/BatchList.test.tsx`         | Create | 批次列表与状态过滤                                   |
| `tests/unit/components/ResultTable.test.tsx`       | Create | 结果展示、导出操作                                   |
| `tests/unit/components/TemplateManager.test.tsx`   | Create | 模板 CRUD 与绑定                                     |
| `tests/unit/components/InterventionPanel.test.tsx` | Create | 介入状态、恢复执行按钮                               |
| `tests/unit/services/SchedulerService.test.ts`     | Create | cron、并发、重启恢复                                 |
| `tests/unit/services/BatchService.test.ts`         | Create | 批次状态流转、断点存储                               |
| `tests/unit/services/ResultService.test.ts`        | Create | 查询、导出、可疑标记                                 |
| `tests/unit/services/SessionRegistry.test.ts`      | Create | 会话 CRUD、任务绑定                                  |
| `tests/unit/services/TemplateService.test.ts`      | Create | 模板持久化                                           |
| `tests/unit/services/ExecutionLogService.test.ts`  | Create | 结构化日志写入与检索                                 |
| `tests/unit/services/AlertService.test.ts`         | Create | 告警聚合与推送                                       |
| `tests/e2e/automation-browser-ops.spec.ts`         | Create | 端到端主链路验收（需先创建 `tests/e2e/` 目录）       |

### Docs

| File                                      | Action | Responsibility                       |
| ----------------------------------------- | ------ | ------------------------------------ |
| `docs/plan-automation-browser-ops-v1.md`  | Modify | 回写实际里程碑、实施状态             |
| `docs/specs-automation-browser-ops-v1.md` | Modify | 回写已实现字段、状态机和限制         |
| `README.md`                               | Modify | 补充 V1 功能入口、测试命令、限制说明 |

---

## Cross-cutting rules

- 所有新 DB 表都通过 `DatabaseService` 统一初始化与迁移，不在各服务里直接散落 `CREATE TABLE`
- 所有新 IPC 先补 `src/shared/constants/channels.ts`（常量）和 `src/shared/types/*`（类型），再在 `src/main/app.ts` 注册 handler（当前 IPC 注册模式在 app.ts 中直接 `ipcMain.handle`）
- `IpcController` 目前无 schema 校验，新增 handler 应在 handler 内部做参数校验（zod 或手写 guard）
- 新状态流转必须先写测试：`task`, `batch`, `intervention`, `alert`
- 优先复用现有 `TaskService`、`FlowRunner`、`TabManager`、`ExecutionPanel`，不要平行造一套
- 渲染进程调用 IPC 统一走 `useIpc()` hook 的 `invoke()` 方法，不直接写 `window.electronAPI.invoke()`
- 每个任务结束前都运行最小必要测试；每个 Phase 结束前运行 `npm run lint`、`npm run typecheck`、`npm test`

---

### Task 1: 建立共享类型、通道与数据库迁移骨架

**Files:**

- Modify: `src/shared/constants/channels.ts`
- Modify: `src/shared/types/task.ts`
- Modify: `src/shared/types/browser.ts`
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Test: `tests/unit/services/TaskService.test.ts`
- Test: `tests/unit/services/IpcController.test.ts`

- [ ] **Step 1: 写任务/批次/调度/介入状态的失败测试**

在 `tests/unit/services/TaskService.test.ts` 增加：

```ts
it('stores schedule and batch metadata on task records', () => {
  expect(task.schedule?.type).toBe('cron');
  expect(task.nextRunAt).toBeDefined();
});
```

- [ ] **Step 2: 写 IPC 通道常量失败测试**

在 `tests/unit/services/IpcController.test.ts` 增加断言，确保 `IPC_CHANNELS` 中存在新通道：

```ts
import { IPC_CHANNELS } from '@shared/constants/channels';

expect(IPC_CHANNELS.TASK_CREATE).toBe('task:create');
expect(IPC_CHANNELS.BATCH_RETRY).toBe('batch:retry');
expect(IPC_CHANNELS.INTERVENTION_RESUME).toBe('intervention:resume');
```

> **注意**：现有 `IPC_CHANNELS` 使用全大写 key（如 `WINDOW_OPEN`、`CONFIG_GET`），新增常量应保持此命名风格。

- [ ] **Step 3: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/services/IpcController.test.ts`

Expected: FAIL，提示缺少字段、通道或 schema

- [ ] **Step 4: 扩展共享类型与通道常量**

最小实现应覆盖：

- `ScheduleConfig`（在 `task.ts` 中，type: 'manual' | 'once' | 'cron'）
- `TaskBatch`（id, taskId, status, startedAt, finishedAt, stepResults, error, breakpoint）
- `TaskBreakpoint`（stepIndex, error, screenshot?, domSnapshot?）
- `InterventionState`（在 `browser.ts` 中扩展，含 taskId, batchId, flowRunnerStatus, webContentsId, breakpoint）
- `ExtractionField` / `ExtractionTemplate`（在新建 `src/shared/types/template.ts` 或直接在 `task.ts` 中）
- `ExtractionResult`（id, taskId, batchId, templateId, data, status, sourceUrl）

> **注意**：`src/shared/types/browser.ts` 当前仅有 `Tab` 接口，介入台类型应在此文件中扩展。

- [ ] **Step 5: 在 `DatabaseService` 中添加迁移骨架**

新增/迁移以下表：

- `task_batches`
- `extraction_templates`
- `extraction_results`
- `sessions`
- `execution_logs`

- [ ] **Step 6: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/services/IpcController.test.ts`

Expected: PASS

- [ ] **Step 7: 提交**

Run:

```bash
git add src/shared/constants/channels.ts src/shared/types src/main/services/DatabaseService.ts tests/unit/services/TaskService.test.ts tests/unit/services/IpcController.test.ts
git commit -m "feat: add automation browser ops shared contracts"
```

### Task 2: 完成任务中心与批次域模型

**Files:**

- Modify: `src/main/services/TaskService.ts`
- Create: `src/main/services/BatchService.ts`
- Modify: `src/main/services/index.ts`
- Test: `tests/unit/services/TaskService.test.ts`
- Test: `tests/unit/services/BatchService.test.ts`

- [ ] **Step 1: 写批次生命周期失败测试**

在 `tests/unit/services/BatchService.test.ts` 覆盖：

- 创建批次默认为 `pending`
- 开始执行进入 `running`
- 成功结束进入 `success`
- 失败时保存 `error` 与 `breakpoint`

- [ ] **Step 2: 写任务复跑失败测试**

在 `tests/unit/services/TaskService.test.ts` 覆盖：

```ts
it('creates a new batch when retrying a failed batch', async () => {
  const retried = await taskService.retryBatch(batch.id);
  expect(retried.id).not.toBe(batch.id);
});
```

- [ ] **Step 3: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/services/BatchService.test.ts`

- [ ] **Step 4: 实现 `BatchService`**

职责：

- `createBatch`
- `startBatch`
- `finishBatch`
- `failBatch`
- `listBatchesByTask`
- `getBatch`

- [ ] **Step 5: 扩展 `TaskService`**

职责：

- 任务扩展字段持久化
- 读取任务状态摘要
- 批次查询代理
- `retryBatch`
- `cloneTask`

- [ ] **Step 6: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/services/TaskService.test.ts tests/unit/services/BatchService.test.ts`

- [ ] **Step 7: 提交**

```bash
git add src/main/services/TaskService.ts src/main/services/BatchService.ts src/main/services/index.ts tests/unit/services/TaskService.test.ts tests/unit/services/BatchService.test.ts
git commit -m "feat: add task batches and retry flow"
```

### Task 3: 接入调度器与执行队列

**Files:**

- Create: `src/main/services/SchedulerService.ts`
- Modify: `src/main/app.ts`
- Modify: `src/main/services/index.ts`
- Modify: `src/main/ipc/IpcController.ts`
- Test: `tests/unit/services/SchedulerService.test.ts`
- Test: `tests/unit/services/AppIpcIntegration.test.ts`

- [ ] **Step 1: 写 cron/并发/恢复失败测试**

在 `tests/unit/services/SchedulerService.test.ts` 覆盖：

- enabled + cron 任务启动时自动注册
- 并发超过上限时新任务进入 pending 队列
- 重启后重新注册 cron 任务

- [ ] **Step 2: 写调度器 IPC 失败测试**

在 `tests/unit/services/AppIpcIntegration.test.ts` 增加：

```ts
expect(await ipc.invoke('scheduler:status')).toMatchObject({
  runningCount: expect.any(Number),
  queuedCount: expect.any(Number),
});
```

- [ ] **Step 3: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/services/SchedulerService.test.ts tests/unit/services/AppIpcIntegration.test.ts`

- [ ] **Step 4: 实现 `SchedulerService`**

实现内容：

- 启动时扫描 enabled 任务
- 注册 cron 计划
- 管理并发队列与超时
- 统一调用 `TaskService` / `BatchService` 开始批次

- [ ] **Step 5: 在 `app.ts` 注册生命周期**

确保：

- `app.whenReady()` 后启动 scheduler（参考现有 `ipcMain.handle` 注册块的位置）
- 应用退出前释放计划（在 `app.on('before-quit')` 中调用 scheduler.stop()）
- 新的 IPC handler 统一通过 `ipcMain.handle(IPC_CHANNELS.XXX, ...)` 注册，与现有模式保持一致

- [ ] **Step 6: 注册调度与批次 IPC**

至少覆盖：

- `scheduler:status`
- `batch:list`
- `batch:detail`
- `batch:retry`

- [ ] **Step 7: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/services/SchedulerService.test.ts tests/unit/services/AppIpcIntegration.test.ts`

- [ ] **Step 8: 提交**

```bash
git add src/main/services/SchedulerService.ts src/main/app.ts src/main/services/index.ts src/main/ipc/IpcController.ts tests/unit/services/SchedulerService.test.ts tests/unit/services/AppIpcIntegration.test.ts
git commit -m "feat: add scheduler and execution queue"
```

### Task 4: 结果中心与结构化执行日志

**Files:**

- Create: `src/main/services/ResultService.ts`
- Create: `src/main/services/ExecutionLogService.ts`
- Modify: `src/engines/automation/AutomationEngine.ts`
- Modify: `src/engines/automation/FlowRunner.ts`
- Test: `tests/unit/services/ResultService.test.ts`
- Test: `tests/unit/services/ExecutionLogService.test.ts`
- Test: `tests/unit/engines/AutomationEngine.test.ts`
- Test: `tests/unit/engines/FlowRunner.test.ts`

- [ ] **Step 1: 写结果入库失败测试**

在 `tests/unit/engines/AutomationEngine.test.ts` 增加：

```ts
it('persists extraction results after successful extract step', async () => {
  expect(resultService.listByBatch(batchId)).toHaveLength(1);
});
```

- [ ] **Step 2: 写结构化执行日志失败测试**

在 `tests/unit/engines/FlowRunner.test.ts` 覆盖：

- 步骤开始写 `info`
- 步骤失败写 `error`
- 查询时支持按 `batchId` 返回有序日志

- [ ] **Step 3: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/services/ResultService.test.ts tests/unit/services/ExecutionLogService.test.ts tests/unit/engines/AutomationEngine.test.ts tests/unit/engines/FlowRunner.test.ts`

- [ ] **Step 4: 实现 `ExecutionLogService`**

能力：

- `append`
- `query`
- `aggregateRecentErrors`

- [ ] **Step 5: 实现 `ResultService`**

能力：

- `saveResult`
- `listResults`
- `getResult`
- `exportResults`
- `markSuspicious`

- [ ] **Step 6: 在 `FlowRunner`/`AutomationEngine` 接入服务**

要求：

- 每步执行前后写日志
- extract 成功直接写结果
- 失败时写截图/错误元数据

- [ ] **Step 7: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/services/ResultService.test.ts tests/unit/services/ExecutionLogService.test.ts tests/unit/engines/AutomationEngine.test.ts tests/unit/engines/FlowRunner.test.ts`

- [ ] **Step 8: 提交**

```bash
git add src/main/services/ResultService.ts src/main/services/ExecutionLogService.ts src/engines/automation/AutomationEngine.ts src/engines/automation/FlowRunner.ts tests/unit/services/ResultService.test.ts tests/unit/services/ExecutionLogService.test.ts tests/unit/engines/AutomationEngine.test.ts tests/unit/engines/FlowRunner.test.ts
git commit -m "feat: add result storage and execution logs"
```

### Task 5: 自动化页面的任务、批次、结果 UI

**Files:**

- Modify: `src/renderer/entries/automation/App.tsx`
- Modify: `src/renderer/entries/automation/components/TaskList.tsx`
- Modify: `src/renderer/entries/automation/components/ExecutionPanel.tsx`
- Create: `src/renderer/entries/automation/components/BatchList.tsx`
- Create: `src/renderer/entries/automation/components/ResultTable.tsx`
- Modify: `src/renderer/shared/hooks/useIpc.ts`
- Test: `tests/unit/components/TaskList.test.tsx`
- Test: `tests/unit/components/ExecutionPanel.test.tsx`
- Test: `tests/unit/components/BatchList.test.tsx`
- Test: `tests/unit/components/ResultTable.test.tsx`

- [ ] **Step 1: 写任务/批次/结果 UI 失败测试**

覆盖：

- 任务启停按钮触发正确 IPC
- 批次列表按状态过滤
- 结果表支持导出按钮

- [ ] **Step 2: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/components/TaskList.test.tsx tests/unit/components/ExecutionPanel.test.tsx tests/unit/components/BatchList.test.tsx tests/unit/components/ResultTable.test.tsx`

- [ ] **Step 3: 实现任务中心主布局**

要求：

- 左侧任务列表
- 中间批次/执行详情
- 底部或右侧结果列表

- [ ] **Step 4: 扩展 `useIpc` 包装器**

在现有 `useIpc()` hook 的 `invoke()` 方法基础上，增加 task/batch/result 专用调用函数（如 `useTaskApi()`、`useBatchApi()`），避免组件中散写字符串通道。现有 `useIpcEvent(channel, callback)` 可用于订阅状态变更事件。

- [ ] **Step 5: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/components/TaskList.test.tsx tests/unit/components/ExecutionPanel.test.tsx tests/unit/components/BatchList.test.tsx tests/unit/components/ResultTable.test.tsx`

- [ ] **Step 6: 提交**

```bash
git add src/renderer/entries/automation/App.tsx src/renderer/entries/automation/components src/renderer/shared/hooks/useIpc.ts tests/unit/components/TaskList.test.tsx tests/unit/components/ExecutionPanel.test.tsx tests/unit/components/BatchList.test.tsx tests/unit/components/ResultTable.test.tsx
git commit -m "feat: add automation task batch result workspace"
```

### Task 6: 浏览器介入台与断点恢复

**Files:**

- Modify: `src/engines/automation/FlowRunner.ts`
- Modify: `src/engines/automation/types.ts`
- Modify: `src/main/browser/TabManager.ts`
- Modify: `src/main/ipc/IpcController.ts`
- Modify: `src/renderer/entries/browser/App.tsx`
- Modify: `src/renderer/entries/browser/components/WebViewContainer.tsx`
- Create: `src/renderer/entries/browser/components/InterventionPanel.tsx`
- Test: `tests/unit/engines/FlowRunner.test.ts`
- Test: `tests/unit/services/TabManager.test.ts`
- Test: `tests/unit/components/WebViewContainer.test.tsx`
- Test: `tests/unit/components/InterventionPanel.test.tsx`

- [ ] **Step 1: 写断点持久化失败测试**

覆盖：

- 失败时把 `stepIndex`、`error`、`screenshot` 写入 batch
- `resume` 时从断点步骤继续

- [ ] **Step 2: 写介入 UI 失败测试**

覆盖：

- 展示当前步骤与错误
- 点击“恢复自动执行”时发送 `intervention:resume`

- [ ] **Step 3: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/engines/FlowRunner.test.ts tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx tests/unit/components/InterventionPanel.test.tsx`

- [ ] **Step 4: 扩展 `FlowRunner` 断点协议**

要求：

- `pauseForIntervention`
- `resumeFromBreakpoint`
- 失败时断点写库

- [ ] **Step 5: 扩展 `TabManager`**

要求：

- 按 `sessionPartition` 找回或重建 tab
- 返回当前 `webContentsId`

- [ ] **Step 6: 实现浏览器介入台 UI**

要求：

- 观察当前 tab
- 展示步骤、错误、截图
- 支持恢复执行

- [ ] **Step 7: 注册介入 IPC**

至少覆盖：

- `intervention:status`
- `intervention:takeover`
- `intervention:resume`
- `intervention:screenshot`

- [ ] **Step 8: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/engines/FlowRunner.test.ts tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx tests/unit/components/InterventionPanel.test.tsx`

- [ ] **Step 9: 提交**

```bash
git add src/engines/automation/FlowRunner.ts src/engines/automation/types.ts src/main/browser/TabManager.ts src/main/ipc/IpcController.ts src/renderer/entries/browser/App.tsx src/renderer/entries/browser/components/WebViewContainer.tsx src/renderer/entries/browser/components/InterventionPanel.tsx tests/unit/engines/FlowRunner.test.ts tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx tests/unit/components/InterventionPanel.test.tsx
git commit -m "feat: add browser intervention workflow"
```

### Task 7: 会话管理与登录态绑定

**Files:**

- Create: `src/main/services/SessionRegistry.ts`
- Modify: `src/main/browser/TabManager.ts`
- Modify: `src/main/services/TaskService.ts`
- Modify: `src/main/ipc/IpcController.ts`
- Test: `tests/unit/services/SessionRegistry.test.ts`
- Test: `tests/unit/services/TabManager.test.ts`
- Test: `tests/unit/services/TaskService.test.ts`

- [ ] **Step 1: 写会话 CRUD 失败测试**

覆盖：

- 创建持久会话生成 `persist:session_xxx`
- 删除会话时清理绑定关系
- 任务绑定会话后执行使用对应 partition

- [ ] **Step 2: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/services/SessionRegistry.test.ts tests/unit/services/TabManager.test.ts tests/unit/services/TaskService.test.ts`

- [ ] **Step 3: 实现 `SessionRegistry`**

能力：

- `createSession`
- `listSessions`
- `deleteSession`
- `bindTaskSession`

- [ ] **Step 4: 在 `TabManager` / `TaskService` 接入会话**

要求：

- 任务执行时优先使用绑定 session
- 无绑定时退回临时 session

- [ ] **Step 5: 注册 session IPC**

至少覆盖：

- `session:list`
- `session:create`
- `session:delete`
- `session:bind`

- [ ] **Step 6: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/services/SessionRegistry.test.ts tests/unit/services/TabManager.test.ts tests/unit/services/TaskService.test.ts`

- [ ] **Step 7: 提交**

```bash
git add src/main/services/SessionRegistry.ts src/main/browser/TabManager.ts src/main/services/TaskService.ts src/main/ipc/IpcController.ts tests/unit/services/SessionRegistry.test.ts tests/unit/services/TabManager.test.ts tests/unit/services/TaskService.test.ts
git commit -m "feat: add session registry and task binding"
```

### Task 8: 录制器与提取模板

**Files:**

- Create: `src/main/services/TemplateService.ts`
- Modify: `src/main/browser/TabManager.ts`
- Modify: `src/main/ipc/IpcController.ts`
- Modify: `src/engines/automation/SelectorGenerator.ts`
- Modify: `src/renderer/entries/automation/components/StepEditor.tsx`
- Create: `src/renderer/entries/automation/components/TemplateManager.tsx`
- Create: `src/renderer/entries/browser/components/RecorderPanel.tsx`
- Test: `tests/unit/services/TemplateService.test.ts`
- Test: `tests/unit/components/StepEditor.test.tsx`
- Test: `tests/unit/components/TemplateManager.test.tsx`

- [ ] **Step 1: 写模板持久化与绑定失败测试**

覆盖：

- 保存模板后可列表查询
- 模板可绑定到任务
- 删除模板后已绑定任务保留快照或显示缺失状态

- [ ] **Step 2: 写录制流程失败测试**

覆盖：

- 点击开始录制触发 `recorder:start`
- 停止录制后返回步骤数组
- 选中字段后生成提取模板

- [ ] **Step 3: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/services/TemplateService.test.ts tests/unit/components/StepEditor.test.tsx tests/unit/components/TemplateManager.test.tsx`

- [ ] **Step 4: 实现 `TemplateService`**

能力：

- `saveTemplate`
- `listTemplates`
- `deleteTemplate`
- `attachTemplateToTask`

- [ ] **Step 5: 实现录制脚本注入和主进程收集**

要求：

- 通过 `webContents.executeJavaScript()` 注入捕获脚本（监听 click/input/change/scroll）
- 将事件映射成 `TaskStep[]`
- 对接 `SelectorGenerator`（现有 API: `generateFromPoint(wc, x, y)` 和 `validate(wc, selector)`）
- 注入脚本通过 `window.postMessage` → WebContentsView `ipc-message` → 主进程，符合 sandbox 安全模型

- [ ] **Step 6: 实现模板管理和录制 UI**

要求：

- `StepEditor` 支持导入录制结果
- `TemplateManager` 支持 CRUD
- `RecorderPanel` 支持开始/停止/预览

- [ ] **Step 7: 注册 recorder/template IPC**

至少覆盖：

- `recorder:start`
- `recorder:stop`
- `template:save`
- `template:list`
- `template:delete`

- [ ] **Step 8: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/services/TemplateService.test.ts tests/unit/components/StepEditor.test.tsx tests/unit/components/TemplateManager.test.tsx`

- [ ] **Step 9: 提交**

```bash
git add src/main/services/TemplateService.ts src/main/browser/TabManager.ts src/main/ipc/IpcController.ts src/engines/automation/SelectorGenerator.ts src/renderer/entries/automation/components/StepEditor.tsx src/renderer/entries/automation/components/TemplateManager.tsx src/renderer/entries/browser/components/RecorderPanel.tsx tests/unit/services/TemplateService.test.ts tests/unit/components/StepEditor.test.tsx tests/unit/components/TemplateManager.test.tsx
git commit -m "feat: add recorder and extraction templates"
```

### Task 9: 告警中心与错误聚合

**Files:**

- Create: `src/main/services/AlertService.ts`
- Modify: `src/main/services/ExecutionLogService.ts`
- Modify: `src/main/ipc/IpcController.ts`
- Modify: `src/renderer/entries/automation/components/ExecutionPanel.tsx`
- Test: `tests/unit/services/AlertService.test.ts`
- Test: `tests/unit/components/ExecutionPanel.test.tsx`

- [ ] **Step 1: 写告警聚合失败测试**

覆盖：

- 最近 N 分钟多个 error 日志按 `taskId` 聚合
- 已读告警不会重复出现在未读列表

- [ ] **Step 2: 运行目标测试确认失败**

Run: `npx vitest run tests/unit/services/AlertService.test.ts tests/unit/components/ExecutionPanel.test.tsx`

- [ ] **Step 3: 实现 `AlertService`**

能力：

- `listAlerts`
- `pushAlert`
- `dismissAlert`
- `aggregateFromExecutionLogs`

- [ ] **Step 4: 在 `ExecutionPanel` 增加告警视图**

要求：

- 最近告警列表
- 一键跳转到对应批次日志
- 已读/未读状态

- [ ] **Step 5: 注册 alert IPC**

至少覆盖：

- `alert:list`
- `alert:dismiss`
- `alert:pushed`

- [ ] **Step 6: 运行目标测试确认通过**

Run: `npx vitest run tests/unit/services/AlertService.test.ts tests/unit/components/ExecutionPanel.test.tsx`

- [ ] **Step 7: 提交**

```bash
git add src/main/services/AlertService.ts src/main/services/ExecutionLogService.ts src/main/ipc/IpcController.ts src/renderer/entries/automation/components/ExecutionPanel.tsx tests/unit/services/AlertService.test.ts tests/unit/components/ExecutionPanel.test.tsx
git commit -m "feat: add alert aggregation workflow"
```

### Task 10: 验收、回写文档与端到端覆盖

**Files:**

- Create: `tests/e2e/automation-browser-ops.spec.ts`
- Modify: `docs/plan-automation-browser-ops-v1.md`
- Modify: `docs/specs-automation-browser-ops-v1.md`
- Modify: `README.md`

- [ ] **Step 1: 创建 E2E 基础设施与场景**

首先创建 `tests/e2e/` 目录和 Playwright 配置文件（如未存在）。package.json 已配置 `"test:e2e": "playwright test"` 和 `@playwright/test` 依赖。

至少覆盖：

- 创建任务并手动执行
- 查看结果并导出
- 失败后进入介入台并恢复执行

> **注意**：E2E 测试应使用本地 mock 页面或固定 fixture 站点，不依赖公网页面，确保 CI 可复现。

- [ ] **Step 2: 运行 E2E 确认失败**

Run: `npm run test:e2e -- --grep automation-browser-ops`

Expected: FAIL，提示页面元素或功能未实现

- [ ] **Step 3: 按 Checklist 补齐遗漏**

对照 `docs/specs-automation-browser-ops-v1.md` 中的验收 checklist 修正实现或文档

- [ ] **Step 4: 回写文档**

回写内容：

- 已实现范围
- 暂不支持内容
- 关键限制（如验证码仅支持人工介入，不做自动破解）

- [ ] **Step 5: 运行全量验证**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e -- --grep automation-browser-ops
```

Expected: 全部通过（单元测试基线：现有 393 + 新增测试全部 pass）

- [ ] **Step 6: 提交**

```bash
git add tests/e2e/automation-browser-ops.spec.ts docs/plan-automation-browser-ops-v1.md docs/specs-automation-browser-ops-v1.md README.md
git commit -m "docs: finalize automation browser ops v1 acceptance"
```

---

## Recommended execution chunks

| Chunk   | Includes  | Why                            |
| ------- | --------- | ------------------------------ |
| Chunk 1 | Task 1-3  | 先把任务、批次、调度底座打稳   |
| Chunk 2 | Task 4-5  | 让结果和 UI 可见，形成日用闭环 |
| Chunk 3 | Task 6-7  | 补上浏览器接管与会话稳定性     |
| Chunk 4 | Task 8-10 | 做效率功能、告警、验收收尾     |

## Verification checkpoints

| Checkpoint   | Commands                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| After Task 3 | `npm run lint ; npm run typecheck ; npx vitest run tests/unit/services/TaskService.test.ts tests/unit/services/BatchService.test.ts tests/unit/services/SchedulerService.test.ts tests/unit/services/AppIpcIntegration.test.ts` |
| After Task 5 | `npm run lint ; npm run typecheck ; npm test`                                                                                                                                                                                   |
| After Task 7 | `npm run lint ; npm run typecheck ; npm test`                                                                                                                                                                                   |
| Final        | `npm run lint ; npm run typecheck ; npm test ; npm run test:e2e -- --grep automation-browser-ops`                                                                                                                               |

> **基线**：当前 393 单元测试全部通过。每个 checkpoint 确保现有测试无回归 + 新增测试全部通过。

## Risks to watch during execution

| Risk                                             | Mitigation                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `FlowRunner` 改动过大导致回归                    | 每次只引入一个状态流转变化，并维持现有 FlowRunner.test.ts 测试通过           |
| `TabManager` 会话恢复复杂                        | 先实现"重建 tab"，再优化成"复用已有 tab"                                     |
| recorder 脚本与 Electron 安全模型冲突            | 先走最小注入脚本（`executeJavaScript` + `postMessage`），不直接暴露 Node API |
| 数据表增多导致查询杂乱                           | 所有 SQL 收敛到对应 service，不在 UI/engine 中散写                           |
| E2E 不稳定                                       | 保持固定 fixture 站点或 mock 页面，不依赖公网                                |
| `IpcController` 无 schema 校验导致运行时类型错误 | 新 handler 内部统一使用 zod 校验参数，拒绝非法 payload                       |

## Notes for execution

- 如果只允许单人串行开发，按 `Chunk 1 → 4` 执行即可
- 如果要并行，建议只在 `Chunk 2` 和 `Chunk 3` 做受控并行，避免多人同时改 `FlowRunner` / `TabManager`
- 开发过程中若发现 `SPEC-A03` 或 `SPEC-A08` 的状态机与实现冲突，优先回写 `docs/specs-automation-browser-ops-v1.md`，不要口头约定
- **分支策略**：建议从当前 `fix/code-review-remediation` 分支切出新分支 `feature/automation-browser-ops-v1`，按 Phase 提交，每个 Phase 结束可合回主分支
- **现有测试基线**：40 文件 / 393 测试 —— 任何时候运行 `npm test` 都不应有回归
