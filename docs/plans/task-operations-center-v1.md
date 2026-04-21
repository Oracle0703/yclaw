# Task Operations Center V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有自动化、Runner、结果、日志和 AI 底座之上，落地“小团队任务运营中台”的第一版主闭环：工作区协作、任务版本发布、执行运营、告警值班、结果证据链、复盘资产与 AI 运营副驾驶。

**Architecture:** 延续“主进程服务 + SQLite 仓储 + IPC + 自动化页多面板”方案，不新建第二套中台应用。主进程继续作为任务、批次、告警、结果、协作状态的唯一事实来源；渲染层在 `automation` 入口内增加工作区、版本、告警、复盘与运营总览面板；AI 通过新增工具接入任务运营语义，而不是构建独立 Agent 系统。

**Tech Stack:** Electron 33、TypeScript 5、React 18、Ant Design 5、Zustand、better-sqlite3、Vitest、Playwright（后续验收）。

---

## 0. 范围与拆分策略

| 项目 | 说明 |
| --- | --- |
| 对应 spec | `docs/specs/task-operations-center-v1.md` |
| 计划范围 | 覆盖 `SPEC-T01 ~ SPEC-T08`，但按“先闭环、后增强”的顺序拆分 |
| 本次实现主线 | `工作区/角色 → 任务版本/审核 → 执行运营总览 → 告警值班 → 结果证据链 → 复盘资产 → AI 运营副驾驶` |
| 明确暂缓 | 多租户、在线多人实时协同、云同步、组织树权限、模板市场 |

> 说明：`task-operations-center-v1` 覆盖多个子系统，因此本计划按 **6 个可独立验收的实现批次** 拆分，而不是一次性并发大改。

---

## 1. 文件结构与职责映射

| 路径 | 类型 | 职责 |
| --- | --- | --- |
| `src/main/services/DatabaseService.ts` | 修改 | 新增中台相关表与迁移版本 |
| `src/shared/types/task-operations.ts` | 新建 | 工作区、任务版本、告警动作、复盘记录、运营摘要等共享类型 |
| `src/main/services/repositories/WorkspaceRepository.ts` | 新建 | 工作区与成员存取 |
| `src/main/services/repositories/TaskRevisionRepository.ts` | 新建 | 任务版本、审核、发布记录 |
| `src/main/services/repositories/ReviewRepository.ts` | 新建 | 复盘记录与模板关联 |
| `src/main/services/WorkspaceService.ts` | 新建 | 工作区、成员、默认策略服务 |
| `src/main/services/TaskRevisionService.ts` | 新建 | 任务版本、审核、发布流 |
| `src/main/services/ReviewService.ts` | 新建 | 复盘记录、复盘动作、模板回流 |
| `src/main/services/AlertService.ts` | 修改 | 从“未读提醒”升级为“值班告警流” |
| `src/main/services/ResultService.ts` | 修改 | 增加质量状态、证据链、版本追溯 |
| `src/main/ipc/task-operations-handlers.ts` | 新建 | 中台专项 IPC 路由 |
| `src/shared/constants/channels.ts` | 修改 | 增加工作区、版本、复盘、运营总览通道 |
| `src/renderer/shared/api/taskOperations.ts` | 新建 | 中台渲染层 API 封装 |
| `src/renderer/shared/hooks/useIpc.ts` | 修改 | 暴露 `taskOperations` API |
| `src/renderer/entries/automation/App.tsx` | 修改 | 增加运营总览、工作区、版本、告警、复盘入口 |
| `src/renderer/entries/automation/components/WorkspaceSwitcher.tsx` | 新建 | 工作区切换与成员概览 |
| `src/renderer/entries/automation/components/OpsSummary.tsx` | 新建 | 执行运营总览 |
| `src/renderer/entries/automation/components/TaskRevisionDrawer.tsx` | 新建 | 任务版本、审核、发布 UI |
| `src/renderer/entries/automation/components/AlertInbox.tsx` | 新建 | 告警认领、升级、关闭 UI |
| `src/renderer/entries/automation/components/ReviewPanel.tsx` | 新建 | 复盘记录、后续动作、模板关联 UI |
| `src/main/ai/tools/taskOpsTools.ts` | 新建 | 中台 AI 工具集 |
| `tests/unit/services/...` | 新增 | 服务与仓储测试 |
| `tests/unit/ipc/task-operations-handlers.test.ts` | 新建 | IPC handler 测试 |
| `tests/unit/components/...` | 新增/修改 | 自动化页新增面板组件测试 |

---

## 2. 实施任务

### Task 1: 工作区与共享类型基础

**Files:**
- Create: `src/shared/types/task-operations.ts`
- Create: `src/main/services/repositories/WorkspaceRepository.ts`
- Create: `src/main/services/WorkspaceService.ts`
- Test: `tests/unit/services/repositories/WorkspaceRepository.test.ts`
- Test: `tests/unit/services/WorkspaceService.test.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/repositories/index.ts`
- Modify: `src/main/services/index.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/constants/channels.ts`

- [x] **Step 1: 先写工作区仓储与服务的失败测试**

```ts
it('creates workspace with default runner policy', () => {
  const created = service.createWorkspace({
    name: '电商巡检组',
    defaultRunnerPolicy: { preferredRunnerKind: 'remote' },
  });
  expect(created.name).toBe('电商巡检组');
});

it('updates member role and keeps audit-safe shape', () => {
  const updated = service.updateMemberRole(workspaceId, memberId, 'operator');
  expect(updated.role).toBe('operator');
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/services/repositories/WorkspaceRepository.test.ts tests/unit/services/WorkspaceService.test.ts`

Expected: FAIL，提示缺少 `WorkspaceRepository` / `WorkspaceService` 或缺少工作区表结构。

- [x] **Step 3: 实现 migration v8、共享类型、仓储与服务**

```ts
export interface WorkspaceRecord {
  id: string;
  name: string;
  description?: string;
  defaultRunnerPolicy?: {
    preferredRunnerKind?: 'local' | 'remote';
    requiredCapabilities?: string[];
  };
  notificationPolicy?: {
    alertAutoEscalateMinutes?: number;
  };
}
```

- [x] **Step 4: 重新运行测试确认通过**

Run: `npx vitest run tests/unit/services/repositories/WorkspaceRepository.test.ts tests/unit/services/WorkspaceService.test.ts`

Expected: PASS，覆盖工作区 CRUD、成员角色更新、默认策略读写。

- [x] **Step 5: Commit**

Skipped: repository instruction says not to commit unless explicitly requested.

```bash
git add src/shared/types/task-operations.ts src/main/services/DatabaseService.ts src/main/services/repositories/WorkspaceRepository.ts src/main/services/WorkspaceService.ts src/main/services/repositories/index.ts src/main/services/index.ts src/shared/types/index.ts src/shared/constants/channels.ts tests/unit/services/repositories/WorkspaceRepository.test.ts tests/unit/services/WorkspaceService.test.ts
git commit -m "feat: add workspace collaboration foundation"
```

### Task 2: 任务版本、审核与发布流

**Files:**
- Create: `src/main/services/repositories/TaskRevisionRepository.ts`
- Create: `src/main/services/TaskRevisionService.ts`
- Test: `tests/unit/services/repositories/TaskRevisionRepository.test.ts`
- Test: `tests/unit/services/TaskRevisionService.test.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/TaskService.ts`
- Modify: `src/main/services/repositories/index.ts`
- Modify: `src/main/services/index.ts`
- Modify: `src/shared/types/task.ts`
- Modify: `src/shared/types/task-operations.ts`
- Modify: `src/shared/constants/channels.ts`

- [x] **Step 1: 先写任务版本服务失败测试**

```ts
it('publishes a revision snapshot from current task flow', () => {
  const revision = service.publishRevision(taskId, {
    version: 'v1',
    changeSummary: '增加登录校验步骤',
    createdBy: 'alice',
  });
  expect(revision.reviewStatus).toBe('pending');
});

it('approves a pending revision and marks it active', () => {
  const approved = service.reviewRevision(revisionId, {
    action: 'approve',
    reviewer: 'owner',
  });
  expect(approved.reviewStatus).toBe('approved');
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/services/repositories/TaskRevisionRepository.test.ts tests/unit/services/TaskRevisionService.test.ts`

Expected: FAIL，提示任务版本仓储/服务或版本表不存在。

- [x] **Step 3: 实现任务版本表、发布与审核服务，并把 `TaskService` 接入版本引用**

```ts
export interface TaskRevision {
  id: string;
  taskId: string;
  version: string;
  snapshot: string;
  reviewStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  changeSummary?: string;
}
```

- [x] **Step 4: 重新运行测试确认通过**

Run: `npx vitest run tests/unit/services/repositories/TaskRevisionRepository.test.ts tests/unit/services/TaskRevisionService.test.ts`

Expected: PASS，覆盖发布、审批、驳回、历史版本查询和当前版本绑定。

- [x] **Step 5: Commit**

Skipped: repository instruction says not to commit unless explicitly requested.

```bash
git add src/main/services/repositories/TaskRevisionRepository.ts src/main/services/TaskRevisionService.ts src/main/services/DatabaseService.ts src/main/services/TaskService.ts src/main/services/repositories/index.ts src/main/services/index.ts src/shared/types/task.ts src/shared/types/task-operations.ts src/shared/constants/channels.ts tests/unit/services/repositories/TaskRevisionRepository.test.ts tests/unit/services/TaskRevisionService.test.ts
git commit -m "feat: add task revision review flow"
```

### Task 3: 中台 IPC 与渲染 API 打通

**Files:**
- Create: `src/main/ipc/task-operations-handlers.ts`
- Create: `src/renderer/shared/api/taskOperations.ts`
- Test: `tests/unit/ipc/task-operations-handlers.test.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/shared/constants/channels.ts`
- Modify: `src/renderer/shared/hooks/useIpc.ts`
- Modify: `src/shared/types/ipc.ts`

- [x] **Step 1: 先写 IPC handler 失败测试**

```ts
it('lists workspaces via IPC', async () => {
  const response = await controller.invoke(IPC_CHANNELS.WORKSPACE_LIST, {});
  expect(response.success).toBe(true);
});

it('publishes task revision via IPC', async () => {
  const response = await controller.invoke(IPC_CHANNELS.TASK_REVISION_PUBLISH, { taskId });
  expect(response.success).toBe(true);
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/ipc/task-operations-handlers.test.ts`

Expected: FAIL，提示通道未注册或 handler 缺失。

- [x] **Step 3: 新增专项 handler 与渲染层 API 工厂**

```ts
export function createTaskOperationsApi(options: { invoke: Invoke }) {
  return {
    listWorkspaces: () => options.invoke(IPC_CHANNELS.WORKSPACE_LIST),
    publishTaskRevision: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.TASK_REVISION_PUBLISH, payload),
    listAlerts: (payload?: unknown) => options.invoke(IPC_CHANNELS.ALERT_LIST, payload),
  };
}
```

- [x] **Step 4: 重新运行测试确认通过**

Run: `npx vitest run tests/unit/ipc/task-operations-handlers.test.ts`

Expected: PASS，覆盖工作区、任务版本、告警动作、复盘记录等通道注册与返回格式。

- [x] **Step 5: Commit**

Skipped: repository instruction says not to commit unless explicitly requested.

```bash
git add src/main/ipc/task-operations-handlers.ts src/main/ipc/index.ts src/renderer/shared/api/taskOperations.ts src/renderer/shared/hooks/useIpc.ts src/shared/constants/channels.ts src/shared/types/ipc.ts tests/unit/ipc/task-operations-handlers.test.ts
git commit -m "feat: expose task operations ipc api"
```

### Task 4: 自动化页的运营总览、工作区与任务版本 UI

**Files:**
- Create: `src/renderer/entries/automation/components/WorkspaceSwitcher.tsx`
- Create: `src/renderer/entries/automation/components/OpsSummary.tsx`
- Create: `src/renderer/entries/automation/components/TaskRevisionDrawer.tsx`
- Test: `tests/unit/components/WorkspaceSwitcher.test.tsx`
- Test: `tests/unit/components/OpsSummary.test.tsx`
- Test: `tests/unit/components/TaskRevisionDrawer.test.tsx`
- Modify: `src/renderer/entries/automation/App.tsx`
- Modify: `src/renderer/entries/automation/components/TaskList.tsx`
- Modify: `tests/unit/components/AutomationApp.test.tsx`
- Modify: `tests/unit/components/TaskList.test.tsx`

- [x] **Step 1: 先写自动化页新增面板的失败测试**

```tsx
it('renders workspace switcher and ops summary in automation app', async () => {
  render(<App />);
  expect(screen.getByText('工作区')).toBeInTheDocument();
  expect(screen.getByText('执行总览')).toBeInTheDocument();
});

it('opens revision drawer for selected task', async () => {
  render(<TaskRevisionDrawer taskId="task-1" open />);
  expect(screen.getByText('任务版本')).toBeInTheDocument();
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/components/WorkspaceSwitcher.test.tsx tests/unit/components/OpsSummary.test.tsx tests/unit/components/TaskRevisionDrawer.test.tsx tests/unit/components/AutomationApp.test.tsx`

Expected: FAIL，提示组件不存在或自动化页未渲染相关入口。

- [x] **Step 3: 在自动化入口加入工作区、执行总览、任务版本抽屉**

```tsx
<WorkspaceSwitcher />
<OpsSummary />
<TaskRevisionDrawer taskId={selectedTaskId} open={revisionOpen} />
```

- [x] **Step 4: 重新运行测试确认通过**

Run: `npx vitest run tests/unit/components/WorkspaceSwitcher.test.tsx tests/unit/components/OpsSummary.test.tsx tests/unit/components/TaskRevisionDrawer.test.tsx tests/unit/components/AutomationApp.test.tsx`

Expected: PASS，自动化页能展示工作区切换、执行总览和版本抽屉入口。

- [x] **Step 5: Commit**

Skipped: repository instruction says not to commit unless explicitly requested.

```bash
git add src/renderer/entries/automation/App.tsx src/renderer/entries/automation/components/WorkspaceSwitcher.tsx src/renderer/entries/automation/components/OpsSummary.tsx src/renderer/entries/automation/components/TaskRevisionDrawer.tsx src/renderer/entries/automation/components/TaskList.tsx tests/unit/components/WorkspaceSwitcher.test.tsx tests/unit/components/OpsSummary.test.tsx tests/unit/components/TaskRevisionDrawer.test.tsx tests/unit/components/AutomationApp.test.tsx tests/unit/components/TaskList.test.tsx
git commit -m "feat: add task operations overview ui"
```

### Task 5: 告警值班流、结果证据链与复盘资产

**Files:**
- Create: `src/main/services/repositories/ReviewRepository.ts`
- Create: `src/main/services/ReviewService.ts`
- Create: `src/renderer/entries/automation/components/AlertInbox.tsx`
- Create: `src/renderer/entries/automation/components/ReviewPanel.tsx`
- Test: `tests/unit/services/repositories/ReviewRepository.test.ts`
- Test: `tests/unit/services/ReviewService.test.ts`
- Test: `tests/unit/components/AlertInbox.test.tsx`
- Test: `tests/unit/components/ReviewPanel.test.tsx`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/AlertService.ts`
- Modify: `src/main/services/repositories/AlertRepository.ts`
- Modify: `src/main/services/ResultService.ts`
- Modify: `src/main/services/repositories/ResultRepository.ts`
- Modify: `src/shared/types/task-operations.ts`
- Modify: `src/shared/types/task.ts`
- Modify: `src/shared/constants/channels.ts`
- Modify: `src/renderer/entries/automation/App.tsx`
- Modify: `tests/unit/services/AlertService.test.ts`
- Modify: `tests/unit/services/ResultService.test.ts`

- [x] **Step 1: 先写值班流、结果证据链、复盘服务失败测试**

```ts
it('claims and escalates alert with action history', () => {
  const claimed = alertService.claimAlert(alertId, 'operator-a');
  expect(claimed.assignee).toBe('operator-a');
});

it('stores review and links follow-up template action', () => {
  const review = reviewService.createReview({
    taskId,
    reviewType: 'failure',
    conclusion: '更新模板选择器',
  });
  expect(review.reviewType).toBe('failure');
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `cmd.exe /c npx vitest run tests/unit/services/AlertService.test.ts tests/unit/services/ResultService.test.ts tests/unit/services/repositories/ReviewRepository.test.ts tests/unit/services/ReviewService.test.ts tests/unit/components/AlertInbox.test.tsx tests/unit/components/ReviewPanel.test.tsx`

Expected: FAIL，提示告警动作历史、复盘表、证据链字段或 UI 缺失。

- [x] **Step 3: 升级告警服务、结果服务并实现复盘仓储/服务/UI**

```ts
type AlertStatus = 'new' | 'claimed' | 'processing' | 'escalated' | 'recovered' | 'closed';

interface ResultEvidenceRef {
  kind: 'log' | 'screenshot' | 'batch' | 'revision';
  refId: string;
}
```

- [x] **Step 4: 重新运行测试确认通过**

Run: `cmd.exe /c npx vitest run tests/unit/services/AlertService.test.ts tests/unit/services/ResultService.test.ts tests/unit/services/repositories/ReviewRepository.test.ts tests/unit/services/ReviewService.test.ts tests/unit/components/AlertInbox.test.tsx tests/unit/components/ReviewPanel.test.tsx`

Expected: PASS，已验证 `6 files / 14 tests passed`，后续补充增强已验证 `7 files / 26 tests passed`，覆盖告警认领/升级/关闭、结果证据链、复盘创建、模板关联与面板交互。

- [x] **Step 5: Commit**

```bash
git add src/main/services/repositories/ReviewRepository.ts src/main/services/ReviewService.ts src/main/services/DatabaseService.ts src/main/services/AlertService.ts src/main/services/repositories/AlertRepository.ts src/main/services/ResultService.ts src/main/services/repositories/ResultRepository.ts src/shared/types/task-operations.ts src/shared/types/task.ts src/shared/constants/channels.ts src/renderer/entries/automation/components/AlertInbox.tsx src/renderer/entries/automation/components/ReviewPanel.tsx src/renderer/entries/automation/App.tsx tests/unit/services/AlertService.test.ts tests/unit/services/ResultService.test.ts tests/unit/services/repositories/ReviewRepository.test.ts tests/unit/services/ReviewService.test.ts tests/unit/components/AlertInbox.test.tsx tests/unit/components/ReviewPanel.test.tsx
git commit -m "feat: add alert duty workflow and review assets"
```

Skipped：仓库指令要求“除非用户明确要求，否则不要提交 commit”，本次仅完成代码与文档回写，不执行提交。

### Task 6: AI 运营副驾驶与中台验收收口

**Files:**
- Create: `src/main/ai/tools/taskOpsTools.ts`
- Test: `tests/unit/services/ToolRegistry.taskOps.test.ts`
- Test: `tests/unit/services/AIService.taskOps.test.ts`
- Modify: `src/main/ai/tools/taskTools.ts`
- Modify: `src/main/ai/ContextManager.ts`
- Modify: `src/main/ai/ToolRegistry.ts`
- Modify: `src/main/ai/index.ts`
- Modify: `src/renderer/entries/automation/components/OpsSummary.tsx`
- Modify: `docs/specs/task-operations-center-v1.md`
- Modify: `docs/overview/roadmap.md`

- [x] **Step 1: 先写中台 AI 工具失败测试**

```ts
it('summarizes task operations status for ai tool calls', async () => {
  const result = await registry.execute('ops_task_summary', { taskId });
  expect(result.success).toBe(true);
});

it('drafts a review from batch, alert and result evidence', async () => {
  const result = await registry.execute('ops_review_draft', { batchId });
  expect(result.success).toBe(true);
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `cmd.exe /c npx vitest run tests/unit/services/ToolRegistry.taskOps.test.ts tests/unit/services/AIService.taskOps.test.ts`

Expected: FAIL，提示缺少中台工具或上下文未提供工作区/告警/复盘信息。

- [x] **Step 3: 实现中台 AI 工具、补齐 ContextManager，并回写验收状态**

```ts
export const taskOpsTools = [
  { name: 'ops_task_summary', confirmationLevel: 0 },
  { name: 'ops_alert_summary', confirmationLevel: 0 },
  { name: 'ops_runner_status', confirmationLevel: 0 },
  { name: 'ops_review_draft', confirmationLevel: 1 },
];
```

- [x] **Step 4: 运行 AI 测试与关键回归测试**

Run: `cmd.exe /c npx vitest run tests/unit/services/ToolRegistry.taskOps.test.ts tests/unit/services/AIService.taskOps.test.ts tests/unit/components/AutomationApp.test.tsx tests/unit/components/AlertInbox.test.tsx tests/unit/components/ReviewPanel.test.tsx`

Expected: PASS，已验证 AI 定向测试 `2 files / 4 tests passed`，补充回归测试 `7 files / 60 tests passed`，AI 工具可读取真实任务运营上下文，自动化页关键回归通过。

- [x] **Step 5: Commit**

```bash
git add src/main/ai/tools/taskOpsTools.ts src/main/ai/tools/taskTools.ts src/main/ai/ContextManager.ts src/main/ai/ToolRegistry.ts src/main/ai/index.ts src/renderer/entries/automation/components/OpsSummary.tsx docs/specs/task-operations-center-v1.md docs/overview/roadmap.md tests/unit/services/ToolRegistry.taskOps.test.ts tests/unit/services/AIService.taskOps.test.ts tests/unit/components/AutomationApp.test.tsx tests/unit/components/AlertInbox.test.tsx tests/unit/components/ReviewPanel.test.tsx
git commit -m "feat: add ai copilots for task operations"
```

Skipped：仓库指令要求“除非用户明确要求，否则不要提交 commit”，本次仅完成实现与文档回写。

---

## 3. 计划级验收命令

| 阶段 | 命令 | 目的 |
| --- | --- | --- |
| 基础服务层 | `npx vitest run tests/unit/services/repositories/WorkspaceRepository.test.ts tests/unit/services/WorkspaceService.test.ts tests/unit/services/repositories/TaskRevisionRepository.test.ts tests/unit/services/TaskRevisionService.test.ts tests/unit/services/repositories/ReviewRepository.test.ts tests/unit/services/ReviewService.test.ts` | 校验新增仓储与服务 |
| IPC 层 | `npx vitest run tests/unit/ipc/task-operations-handlers.test.ts` | 校验新增 IPC 路由 |
| 组件层 | `npx vitest run tests/unit/components/WorkspaceSwitcher.test.tsx tests/unit/components/OpsSummary.test.tsx tests/unit/components/TaskRevisionDrawer.test.tsx tests/unit/components/AlertInbox.test.tsx tests/unit/components/ReviewPanel.test.tsx tests/unit/components/AutomationApp.test.tsx` | 校验自动化页中台 UI |
| AI 层 | `npx vitest run tests/unit/services/ToolRegistry.taskOps.test.ts tests/unit/services/AIService.taskOps.test.ts` | 校验 AI 运营副驾驶 |
| 汇总回归 | `npx vitest run tests/unit/services/AlertService.test.ts tests/unit/services/ResultService.test.ts tests/unit/components/TaskList.test.tsx tests/unit/components/ResultTable.test.tsx tests/unit/components/RunnerSchedulerPanel.test.tsx` | 校验未破坏既有自动化链路 |

---

## 4. 风险与控制

| 风险 | 影响 | 控制策略 |
| --- | --- | --- |
| 中台需求跨度大 | 一次性修改过多，容易引发回归 | 严格按 6 个任务分批提交，每批先测后合 |
| 现有自动化页已较复杂 | UI 容易继续膨胀 | 新增面板保持独立组件，避免把逻辑堆进 `App.tsx` |
| SQLite 迁移叠加较多 | 破坏已有测试数据库 | 所有迁移先写仓储测试，再补 `DatabaseService` 版本 |
| 告警与结果模型已有线上语义 | 粗暴改字段会影响旧逻辑 | 扩展字段优先新增列，不直接破坏旧字段 |
| AI 价值容易漂移为泛聊天 | 验收模糊 | 工具名、输入输出、引用上下文都围绕任务运营场景约束 |

---

## 5. 完成定义

| 项目 | 完成标准 |
| --- | --- |
| 协作基础 | 可以创建工作区、管理角色、给任务和告警分配责任人 |
| 任务资产 | 任务具备版本、审核、发布、归档能力 |
| 执行运营 | 自动化页能同时查看任务、批次、Runner、告警和版本状态 |
| 值班处理 | 告警支持认领、升级、备注、关闭，并能跳转失败现场 |
| 结果追溯 | 结果可回溯到批次、日志、截图与任务版本 |
| 资产沉淀 | 失败任务可形成复盘记录并关联模板更新 |
| AI 助手 | 能给出任务摘要、告警摘要、Runner 状态和复盘初稿 |

---

## 6. 执行建议

| 模式 | 说明 |
| --- | --- |
| 推荐 | 先执行 `Task 1 ~ Task 3`，把基础模型、服务和 IPC 打稳，再进入 UI 与 AI |
| 并行边界 | `Task 4` 与 `Task 5` 可在 `Task 3` 完成后并行；`Task 6` 必须最后做 |
| 文档回写 | 每完成一个任务，就回写 `docs/specs/task-operations-center-v1.md` 的实施回写表 |
