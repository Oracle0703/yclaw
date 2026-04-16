# Automation Task Name Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add basic task-name editing to the automation page and save task names together with task steps through the existing `task:save` flow.

**Architecture:** Keep one save path for task metadata and steps. The renderer owns draft state (`taskName`, `steps`, selected task), `TaskService` owns name normalization and new/update flow creation, and `DatabaseService.saveTaskFlow` remains the persistence boundary.

**Tech Stack:** Electron IPC, React 18, TypeScript 5.7, Ant Design 5, Vitest, Testing Library

---

## Reference

| Item | Path |
|---|---|
| Approved design spec | `docs/superpowers/specs/2026-04-16-automation-task-name-editing-design.md` |
| Current automation page | `src/renderer/entries/automation/App.tsx` |
| Current task service | `src/main/services/TaskService.ts` |
| Current IPC registration | `src/main/app.ts` |

## File Structure

| File | Responsibility |
|---|---|
| `src/main/services/TaskService.ts` | Rename saving method to task-flow level and normalize task names |
| `src/main/app.ts` | Accept `name` in `task:save` IPC payload and call the task-flow save method |
| `src/renderer/entries/automation/App.tsx` | Add `taskName` state and a top-level task-name input |
| `tests/unit/services/TaskService.test.ts` | Verify service-level naming behavior |
| `tests/unit/services/AppIpcIntegration.test.ts` | Verify IPC payload includes task name |
| `tests/unit/components/AutomationApp.test.tsx` | Verify UI loads, edits, and saves task names |

## Task 1: Service Save Contract

**Files:**
- Modify: `src/main/services/TaskService.ts`
- Test: `tests/unit/services/TaskService.test.ts`

- [ ] **Step 1: Write failing tests for service naming**

Add tests to `tests/unit/services/TaskService.test.ts`:

```ts
it('saves updated task name with edited steps', () => {
  const nextSteps = [
    ...sampleFlow.steps,
    {
      id: 'step-2',
      name: '采集价格',
      action: { type: 'extract' as const, selector: '.price' },
    },
  ];

  const result = service.saveTaskFlow('task-1', {
    name: '  价格采集任务  ',
    steps: nextSteps,
  });

  expect(mockDb.saveTaskFlow).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'task-1',
      name: '价格采集任务',
      steps: nextSteps,
    }),
  );
  expect(result).toEqual(
    expect.objectContaining({
      id: 'task-1',
      name: '价格采集任务',
      steps: nextSteps,
    }),
  );
});

it('falls back to default task name when creating a task with blank name', () => {
  const result = service.saveTaskFlow(null, {
    name: '   ',
    steps: [
      {
        id: 'step-new-1',
        name: '打开首页',
        action: { type: 'click' as const, selector: '#home' },
      },
    ],
  });

  expect(mockDb.saveTaskFlow).toHaveBeenCalledWith(
    expect.objectContaining({
      id: expect.any(String),
      name: '未命名任务',
    }),
  );
  expect(result.name).toBe('未命名任务');
});
```

- [ ] **Step 2: Run the service tests and verify RED**

Run:

```bash
cmd.exe /c npx vitest run tests/unit/services/TaskService.test.ts --pool=forks --poolOptions.forks.singleFork=true
```

Expected:
- FAIL because `TaskService.saveTaskFlow` does not exist yet.

- [ ] **Step 3: Implement the minimal service method**

In `src/main/services/TaskService.ts`:
- Add payload interface near `TaskServiceOptions`.
- Rename or replace `saveTaskSteps` with `saveTaskFlow`.
- Keep a compatibility wrapper only if another call site still uses `saveTaskSteps`; otherwise remove it.

Implementation shape:

```ts
interface SaveTaskFlowPayload {
  name?: string;
  steps: TaskFlow['steps'];
}

saveTaskFlow(
  taskId: string | null | undefined,
  payload: SaveTaskFlowPayload,
): TaskFlow {
  const now = new Date().toISOString();
  const normalizedName = payload.name?.trim() || '未命名任务';
  const currentFlow = taskId
    ? this.getTaskFlow(taskId)
    : {
        id: crypto.randomUUID(),
        name: normalizedName,
        steps: [],
        createdAt: now,
        updatedAt: now,
      };

  const nextFlow: TaskFlow = {
    ...currentFlow,
    name: normalizedName,
    steps: payload.steps,
    updatedAt: now,
  };

  this.databaseService.saveTaskFlow(nextFlow);
  return nextFlow;
}
```

- [ ] **Step 4: Run the service tests and verify GREEN**

Run:

```bash
cmd.exe /c npx vitest run tests/unit/services/TaskService.test.ts --pool=forks --poolOptions.forks.singleFork=true
```

Expected:
- PASS for `TaskService` tests.

- [ ] **Step 5: Commit service contract**

Run:

```bash
git add src/main/services/TaskService.ts tests/unit/services/TaskService.test.ts
git commit -m "feat: save automation task names in service"
```

## Task 2: IPC Payload Contract

**Files:**
- Modify: `src/main/app.ts`
- Test: `tests/unit/services/AppIpcIntegration.test.ts`

- [ ] **Step 1: Write failing IPC test for name payload**

Add or update a test in `tests/unit/services/AppIpcIntegration.test.ts`:

```ts
it('persists updated task name through task:save', async () => {
  const app = new App();

  await app.start();

  const handler = handlers.get(IPC_CHANNELS.TASK_SAVE);
  expect(handler).toBeDefined();

  const response = await handler!({}, {
    taskId: 'task-1',
    name: '价格采集任务',
    steps: [
      {
        id: 'step-1',
        name: '打开页面',
        action: { type: 'click', selector: '#open' },
      },
    ],
  });

  expect(mockDbSaveTaskFlow).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'task-1',
      name: '价格采集任务',
    }),
  );
  expect(response).toMatchObject({
    success: true,
    data: {
      id: 'task-1',
      name: '价格采集任务',
    },
  });
});
```

- [ ] **Step 2: Run the IPC test and verify RED**

Run:

```bash
cmd.exe /c npx vitest run tests/unit/services/AppIpcIntegration.test.ts --pool=forks --poolOptions.forks.singleFork=true
```

Expected:
- FAIL because `task:save` still calls the old task-step method or ignores `name`.

- [ ] **Step 3: Update IPC handler**

In `src/main/app.ts`, change `TASK_SAVE` handling to:

```ts
this.ipcController.handle(IPC_CHANNELS.TASK_SAVE, (params: unknown) => {
  const { taskId, name, steps } = params as {
    taskId?: string | null;
    name?: string;
    steps: TaskFlow['steps'];
  };
  return this.taskService.saveTaskFlow(taskId, { name, steps });
});
```

- [ ] **Step 4: Run IPC test and verify GREEN**

Run:

```bash
cmd.exe /c npx vitest run tests/unit/services/AppIpcIntegration.test.ts --pool=forks --poolOptions.forks.singleFork=true
```

Expected:
- PASS for IPC integration tests.

- [ ] **Step 5: Commit IPC contract**

Run:

```bash
git add src/main/app.ts tests/unit/services/AppIpcIntegration.test.ts
git commit -m "feat: pass automation task names through ipc"
```

## Task 3: Renderer Task Name Input

**Files:**
- Modify: `src/renderer/entries/automation/App.tsx`
- Test: `tests/unit/components/AutomationApp.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests to `tests/unit/components/AutomationApp.test.tsx`:

```tsx
it('loads selected task name into the task name input', async () => {
  render(<AutomationApp />);

  fireEvent.click(screen.getByRole('button', { name: '选择任务' }));

  const nameInput = await screen.findByPlaceholderText('请输入任务名称');
  expect(nameInput).toHaveValue('采集任务');
});

it('saves edited task name with selected task steps', async () => {
  render(<AutomationApp />);

  fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
  const nameInput = await screen.findByPlaceholderText('请输入任务名称');

  fireEvent.change(nameInput, { target: { value: '价格采集任务' } });
  fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
  fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

  await waitFor(() => {
    expect(window.electronAPI.invoke).toHaveBeenCalledWith(
      'task:save',
      expect.objectContaining({
        taskId: 'task-1',
        name: '价格采集任务',
        steps: expect.arrayContaining([
          expect.objectContaining({ id: 'step-3' }),
        ]),
      }),
    );
  });
});

it('passes task name when creating a new task', async () => {
  render(<AutomationApp />);

  fireEvent.click(screen.getByRole('button', { name: /新建任务/ }));
  fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
    target: { value: '新任务名称' },
  });
  fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
  fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

  await waitFor(() => {
    expect(window.electronAPI.invoke).toHaveBeenCalledWith(
      'task:save',
      expect.objectContaining({
        taskId: null,
        name: '新任务名称',
      }),
    );
  });
});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```bash
cmd.exe /c npx vitest run tests/unit/components/AutomationApp.test.tsx --pool=forks --poolOptions.forks.singleFork=true
```

Expected:
- FAIL because the task-name input does not exist yet.

- [ ] **Step 3: Add task-name state and input**

In `src/renderer/entries/automation/App.tsx`:
- Import `Input` from `antd`.
- Add `const [taskName, setTaskName] = useState('');`.
- On new task: call `setTaskName('')`.
- On selected task load: call `setTaskName(flow.name)`.
- On save: pass `name: taskName`.
- After save: call `setTaskName(saved.name)`.

Minimal UI shape:

```tsx
<Input
  aria-label="任务名称"
  placeholder="请输入任务名称"
  value={taskName}
  onChange={(event) => setTaskName(event.target.value)}
  style={{ width: 220 }}
/>
```

Place it in the existing `PageShell.extra` `Space`, before `新建任务`.

- [ ] **Step 4: Run UI tests and verify GREEN**

Run:

```bash
cmd.exe /c npx vitest run tests/unit/components/AutomationApp.test.tsx --pool=forks --poolOptions.forks.singleFork=true
```

Expected:
- PASS for automation page component tests.

- [ ] **Step 5: Commit renderer UI**

Run:

```bash
git add src/renderer/entries/automation/App.tsx tests/unit/components/AutomationApp.test.tsx
git commit -m "feat: add automation task name editor"
```

## Task 4: Final Verification

**Files:**
- Verify: `src/main/services/TaskService.ts`
- Verify: `src/main/app.ts`
- Verify: `src/renderer/entries/automation/App.tsx`
- Verify: `tests/unit/services/TaskService.test.ts`
- Verify: `tests/unit/services/AppIpcIntegration.test.ts`
- Verify: `tests/unit/components/AutomationApp.test.tsx`

- [ ] **Step 1: Run focused regression suite**

Run:

```bash
cmd.exe /c npx vitest run tests/unit/services/TaskService.test.ts tests/unit/services/AppIpcIntegration.test.ts tests/unit/components/AutomationApp.test.tsx --pool=forks --poolOptions.forks.singleFork=true
```

Expected:
- PASS for all focused tests.

- [ ] **Step 2: Run typecheck**

Run:

```bash
cmd.exe /c npm run typecheck
```

Expected:
- Exit code `0`.

- [ ] **Step 3: Run targeted lint**

Run:

```bash
cmd.exe /c npx eslint src/main/services/TaskService.ts src/main/app.ts src/renderer/entries/automation/App.tsx tests/unit/services/TaskService.test.ts tests/unit/services/AppIpcIntegration.test.ts tests/unit/components/AutomationApp.test.tsx
```

Expected:
- Exit code `0`.

- [ ] **Step 4: Final commit if any verification cleanup occurred**

Run only if Task 4 required extra edits:

```bash
git add src/main/services/TaskService.ts src/main/app.ts src/renderer/entries/automation/App.tsx tests/unit/services/TaskService.test.ts tests/unit/services/AppIpcIntegration.test.ts tests/unit/components/AutomationApp.test.tsx
git commit -m "fix: stabilize automation task name editing"
```

## Notes

| Topic | Decision |
|---|---|
| Plan review | In this Codex session, subagent review is only available if the user explicitly requests delegation. If requested, dispatch a plan-document-reviewer with the spec path and this plan path. |
| Existing untracked docs | Do not accidentally stage `docs/roadmap-next.md` or `docs/superpowers/plans/2026-04-15-automation-mainline-near-term.md` unless explicitly requested. |
| Database tests | Avoid adding real `better-sqlite3` unit tests in this task because the local native module has previously shown Node ABI mismatch issues. |

