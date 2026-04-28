# AliyunDrive Signin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-site AliyunDrive sign-in task inside the existing automation module with browser-session-first execution, `refresh_token` API fallback, manual intervention retry, and configurable notification delivery.

**Architecture:** Extend the existing `TaskFlow` model instead of inventing a new task system. Persist sign-in-specific config inside the existing task snapshot, execute through a dedicated `SigninTaskService` and `AliyunDriveSigninProvider`, surface task state in the automation renderer, and reuse `SessionRegistry`, `SchedulerService`, `AlertService`, and intervention/browser plumbing already in the app. Add a narrow notification layer that supports in-app alerts first and SMTP email second, while leaving Webhook as a follow-up path rather than bloating V1.

**Tech Stack:** Electron IPC, React 18, TypeScript 5.7, Ant Design 5, Vitest, Testing Library, existing SQLite repositories, existing EventBus / AlertService / SchedulerService

---

## Reference

| Item | Path |
| --- | --- |
| Approved design spec | `docs/superpowers/specs/2026-04-28-aliyundrive-signin-design.md` |
| Legacy script reference | `docs/auto.js` |
| Existing task types | `src/shared/types/task.ts` |
| Existing scheduler | `src/main/services/SchedulerService.ts` |
| Existing session registry | `src/main/services/SessionRegistry.ts` |
| Existing task service | `src/main/services/TaskService.ts` |
| Existing IPC channel registry | `src/shared/constants/channels.ts` |
| Existing automation page | `src/renderer/entries/automation/App.tsx` |
| Existing settings page | `src/renderer/entries/workbench/pages/Settings.tsx` |

## File Structure

| File | Responsibility |
| --- | --- |
| `src/shared/types/signin.ts` | Shared sign-in task config, run status, failure reason, notification payload types |
| `src/shared/types/task.ts` | Extend `TaskFlow` with optional sign-in metadata and task kind |
| `src/shared/types/config.ts` | Add optional notification/email settings shape |
| `src/shared/types/index.ts` | Export new sign-in and config types |
| `src/shared/constants/channels.ts` | Add sign-in-specific IPC channels |
| `src/main/services/repositories/TaskRepository.ts` | Persist and read sign-in metadata inside `flow_json` snapshot |
| `src/main/services/TaskService.ts` | Accept and round-trip sign-in task payloads through create/update/save paths |
| `src/main/services/signin/types.ts` | Main-process-only provider and execution helper types |
| `src/main/services/signin/AliyunDriveLocators.ts` | Centralize resilient page locator candidates |
| `src/main/services/signin/AliyunDriveApiFallback.ts` | Migrate `refresh_token -> access_token -> sign_in / reward` logic from `docs/auto.js` |
| `src/main/services/signin/AliyunDriveSigninProvider.ts` | Execute browser-first flow, success checks, fallback, and failure classification |
| `src/main/services/signin/NotificationService.ts` | Fan out in-app alerts and email notifications for key sign-in events |
| `src/main/services/signin/EmailNotifier.ts` | SMTP notification delivery adapter |
| `src/main/services/signin/SigninTaskService.ts` | Orchestrate scheduling, retries, provider execution, intervention state, and notifications |
| `src/main/ipc/signin-handlers.ts` | Register sign-in-specific IPC handlers |
| `src/main/app.ts` | Wire services, register handlers, and bridge sign-in execution with scheduler / browser / alerts |
| `src/renderer/entries/automation/components/SigninTaskPanel.tsx` | Task configuration form for AliyunDrive sign-in |
| `src/renderer/entries/automation/components/SigninRunStatusCard.tsx` | Show latest sign-in run state, failure reason, and retry CTA |
| `src/renderer/entries/automation/App.tsx` | Mount new sign-in task UI into the automation page |
| `src/renderer/entries/workbench/pages/Settings.tsx` | Add email notification config UI and test-send action |
| `tests/unit/services/repositories/TaskRepository.test.ts` | Verify sign-in metadata persistence |
| `tests/unit/services/TaskService.test.ts` | Verify create/update/save round-trips sign-in metadata |
| `tests/unit/services/SchedulerService.test.ts` | Verify retry scheduling support for sign-in tasks |
| `tests/unit/services/SessionRegistry.test.ts` | Verify AliyunDrive session binding assumptions stay valid |
| `tests/unit/services/signin/AliyunDriveApiFallback.test.ts` | Verify token, sign-in, reward, and error handling |
| `tests/unit/services/signin/AliyunDriveSigninProvider.test.ts` | Verify browser success, API fallback, and intervention transitions |
| `tests/unit/services/signin/NotificationService.test.ts` | Verify notification trigger policy and email fan-out |
| `tests/unit/ipc/signin-handlers.spec.ts` | Verify handler registration and payload forwarding |
| `tests/unit/components/SigninTaskPanel.test.tsx` | Verify renderer task config form behavior |
| `tests/unit/components/SigninRunStatusCard.test.tsx` | Verify state rendering and retry CTA |
| `tests/unit/components/Settings.test.tsx` | Verify notification settings form |

## Task 1: Extend Shared Types and Task Persistence for Sign-In Metadata

**Files:**
- Create: `src/shared/types/signin.ts`
- Modify: `src/shared/types/task.ts`
- Modify: `src/shared/types/config.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/main/services/repositories/TaskRepository.ts`
- Test: `tests/unit/services/repositories/TaskRepository.test.ts`
- Test: `tests/unit/services/TaskService.test.ts`

- [ ] **Step 1: Write failing repository tests for sign-in metadata persistence**

Add test cases to `tests/unit/services/repositories/TaskRepository.test.ts` that:

```ts
it('persists signin metadata inside flow_json and restores it from getTaskFlow', () => {
  const flow: TaskFlow = {
    id: 'task-signin-1',
    name: '阿里云盘签到',
    kind: 'aliyundrive-signin',
    entryUrl: 'https://www.aliyundrive.com/',
    steps: [],
    signin: {
      site: 'aliyundrive',
      mode: 'browser-first-api-fallback',
      fallbackApiEnabled: true,
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
      manualInterventionEnabled: true,
    },
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  };

  repository.saveTaskFlow(flow);

  expect(repository.getTaskFlow('task-signin-1')).toMatchObject({
    kind: 'aliyundrive-signin',
    signin: {
      site: 'aliyundrive',
      fallbackApiEnabled: true,
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
    },
  });
});
```

- [ ] **Step 2: Write failing task service tests for create/update round-trip**

Add tests to `tests/unit/services/TaskService.test.ts` that verify:

```ts
it('creates a sign-in task with kind and signin config', () => {
  service.createTask({
    name: '阿里云盘签到',
    entryUrl: 'https://www.aliyundrive.com/',
    sessionId: 'session-1',
    enabled: true,
    signin: {
      site: 'aliyundrive',
      mode: 'browser-first-api-fallback',
      fallbackApiEnabled: true,
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
      manualInterventionEnabled: true,
    },
  });

  expect(mockTaskRepository.createTask).toHaveBeenCalledWith(
    expect.objectContaining({
      flowJson: expect.stringContaining('"kind":"aliyundrive-signin"'),
    }),
  );
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
npx vitest run tests/unit/services/repositories/TaskRepository.test.ts tests/unit/services/TaskService.test.ts
```

Expected: FAIL because `TaskFlow` and persistence do not yet support `kind` / `signin`.

- [ ] **Step 4: Add shared sign-in types**

Create `src/shared/types/signin.ts` with:

```ts
export type SigninTaskKind = 'aliyundrive-signin';

export type SigninFailureReason =
  | 'session_expired'
  | 'activity_not_found'
  | 'date_card_not_found'
  | 'reward_button_not_found'
  | 'already_claimed'
  | 'api_token_invalid'
  | 'api_request_failed'
  | 'unknown';

export type SigninRunStatus =
  | 'pending'
  | 'running_browser'
  | 'running_api_fallback'
  | 'retry_scheduled'
  | 'needs_intervention'
  | 'success'
  | 'failed';

export interface SigninTaskConfig {
  site: 'aliyundrive';
  mode: 'browser-first-api-fallback';
  fallbackApiEnabled: boolean;
  refreshToken?: string | null;
  maxRetryPerDay: number;
  manualInterventionEnabled: true;
}

export interface SigninRunSummary {
  taskId: string;
  status: SigninRunStatus;
  strategyUsed?: 'browser' | 'api-fallback' | 'manual-retry';
  failureReason?: SigninFailureReason;
  detail?: string;
  runAt: string;
  retryCount: number;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  to: string[];
}
```

- [ ] **Step 5: Extend `TaskFlow` and config types**

Modify `src/shared/types/task.ts` and `src/shared/types/config.ts` to add:

```ts
import type { SigninTaskConfig, SigninTaskKind, EmailNotificationConfig } from './signin';

export interface TaskFlow {
  kind?: 'generic' | SigninTaskKind;
  signin?: SigninTaskConfig | null;
}

export interface GeneralConfig {
  notificationEmail?: EmailNotificationConfig;
}
```

Keep `kind` optional and default it later in service/repository code so existing tasks remain compatible.

- [ ] **Step 6: Export the new types**

Update `src/shared/types/index.ts` to export all sign-in types and `EmailNotificationConfig`.

- [ ] **Step 7: Persist `kind` and `signin` inside `flow_json`**

Modify `src/main/services/repositories/TaskRepository.ts` to:

```ts
const flowJson = JSON.stringify({
  steps: flow.steps,
  entryUrl: flow.entryUrl,
  kind: flow.kind ?? 'generic',
  signin: flow.signin ?? null,
});
```

and restore them in `getTaskFlow()`:

```ts
return {
  ...,
  kind: parsed.kind ?? 'generic',
  signin: parsed.signin ?? null,
};
```

Do the same for `getTasks()` if you want task list summaries to expose sign-in task kind later.

- [ ] **Step 8: Round-trip sign-in metadata through `TaskService`**

Modify `src/main/services/TaskService.ts` so `createTask`, `updateTaskFlow`, and `saveTaskFlow` preserve:

```ts
kind: payload.signin ? 'aliyundrive-signin' : existing.kind ?? 'generic',
signin: payload.signin ?? existing.signin ?? null,
```

Avoid forcing sign-in metadata into generic task save paths unless explicitly present.

- [ ] **Step 9: Re-run tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit/services/repositories/TaskRepository.test.ts tests/unit/services/TaskService.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/shared/types/signin.ts src/shared/types/task.ts src/shared/types/config.ts src/shared/types/index.ts src/main/services/repositories/TaskRepository.ts src/main/services/TaskService.ts tests/unit/services/repositories/TaskRepository.test.ts tests/unit/services/TaskService.test.ts
git commit -m "feat: add sign-in task metadata model"
```

## Task 2: Add AliyunDrive API Fallback and Provider Failure Classification

**Files:**
- Create: `src/main/services/signin/types.ts`
- Create: `src/main/services/signin/AliyunDriveApiFallback.ts`
- Create: `src/main/services/signin/AliyunDriveLocators.ts`
- Create: `src/main/services/signin/AliyunDriveSigninProvider.ts`
- Test: `tests/unit/services/signin/AliyunDriveApiFallback.test.ts`
- Test: `tests/unit/services/signin/AliyunDriveSigninProvider.test.ts`

- [ ] **Step 1: Write failing API fallback tests**

Create `tests/unit/services/signin/AliyunDriveApiFallback.test.ts` with cases for:

```ts
it('returns success when sign-in and reward both succeed', async () => {
  const result = await fallback.run({
    refreshToken: 'rt-demo',
  });

  expect(result).toMatchObject({
    status: 'success',
    strategyUsed: 'api-fallback',
  });
});

it('classifies invalid refresh token as api_token_invalid', async () => {
  await expect(fallback.run({ refreshToken: 'bad-token' })).resolves.toMatchObject({
    status: 'failed',
    failureReason: 'api_token_invalid',
  });
});
```

- [ ] **Step 2: Write failing provider tests**

Create `tests/unit/services/signin/AliyunDriveSigninProvider.test.ts` with cases for:

```ts
it('uses browser flow first and short-circuits on success', async () => {
  const result = await provider.run({ ...browserSuccessFixture });

  expect(result).toMatchObject({
    status: 'success',
    strategyUsed: 'browser',
  });
});

it('falls back to api when browser cannot find reward button', async () => {
  const result = await provider.run({ ...rewardButtonMissingFixture });

  expect(result).toMatchObject({
    status: 'success',
    strategyUsed: 'api-fallback',
    failureReason: 'reward_button_not_found',
  });
});

it('requests intervention when browser and api both fail', async () => {
  const result = await provider.run({ ...fullFailureFixture });

  expect(result).toMatchObject({
    status: 'needs_intervention',
    failureReason: 'api_request_failed',
  });
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
npx vitest run tests/unit/services/signin/AliyunDriveApiFallback.test.ts tests/unit/services/signin/AliyunDriveSigninProvider.test.ts
```

Expected: FAIL because the provider files do not exist.

- [ ] **Step 4: Add main-process sign-in service types**

Create `src/main/services/signin/types.ts` with focused types for:

```ts
export interface SigninExecutionContext {
  taskId: string;
  sessionPartition: string;
  entryUrl: string;
  refreshToken?: string | null;
  maxRetryPerDay: number;
}

export interface SigninProviderResult {
  status: SigninRunStatus;
  strategyUsed?: 'browser' | 'api-fallback' | 'manual-retry';
  failureReason?: SigninFailureReason;
  detail?: string;
}
```

- [ ] **Step 5: Implement API fallback service**

Create `src/main/services/signin/AliyunDriveApiFallback.ts` to port the useful parts of `docs/auto.js`:

```ts
const AUTH_URL = 'https://auth.aliyundrive.com/v2/account/token';
const SIGNIN_URL = 'https://member.aliyundrive.com/v1/activity/sign_in_list';
const REWARD_URL = 'https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile';
```

Implement:

```ts
async run(input: { refreshToken: string }): Promise<SigninProviderResult>
```

and classify:

```ts
'api_token_invalid'
'already_claimed'
'api_request_failed'
```

- [ ] **Step 6: Centralize page locators**

Create `src/main/services/signin/AliyunDriveLocators.ts` with constants/helpers for:

```ts
export const ACTIVITY_SECTION_TEXTS = ['精选活动'];
export const REWARD_BUTTON_TEXTS = ['领取', '立即领取', '马上领取', '已领取'];
```

and helper snippets that the provider can inject into a page script.

- [ ] **Step 7: Implement the browser-first provider**

Create `src/main/services/signin/AliyunDriveSigninProvider.ts` that:

```ts
async run(context: SigninExecutionContext): Promise<SigninProviderResult>
```

performs:

1. Open or reuse the AliyunDrive page in the bound session partition.
2. Execute page script that finds the activity area, first date card, and reward button.
3. Classify browser failures as `activity_not_found`, `date_card_not_found`, `reward_button_not_found`, `session_expired`, or `unknown`.
4. If browser succeeds, return `success`.
5. If browser fails and `refreshToken` exists, call `AliyunDriveApiFallback`.
6. If both fail, return `needs_intervention`.

- [ ] **Step 8: Re-run tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit/services/signin/AliyunDriveApiFallback.test.ts tests/unit/services/signin/AliyunDriveSigninProvider.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main/services/signin/types.ts src/main/services/signin/AliyunDriveApiFallback.ts src/main/services/signin/AliyunDriveLocators.ts src/main/services/signin/AliyunDriveSigninProvider.ts tests/unit/services/signin/AliyunDriveApiFallback.test.ts tests/unit/services/signin/AliyunDriveSigninProvider.test.ts
git commit -m "feat: add aliyundrive sign-in provider"
```

## Task 3: Build Sign-In Orchestration, Retry Logic, and Notification Service

**Files:**
- Create: `src/main/services/signin/NotificationService.ts`
- Create: `src/main/services/signin/EmailNotifier.ts`
- Create: `src/main/services/signin/SigninTaskService.ts`
- Modify: `src/main/services/SchedulerService.ts`
- Modify: `src/main/services/AlertService.ts`
- Test: `tests/unit/services/signin/NotificationService.test.ts`
- Test: `tests/unit/services/SchedulerService.test.ts`

- [ ] **Step 1: Write failing notification tests**

Create `tests/unit/services/signin/NotificationService.test.ts` to cover:

```ts
it('emits in-app alert when a task needs intervention', async () => {
  await service.notify({
    taskName: '阿里云盘签到',
    status: 'needs_intervention',
    failureReason: 'session_expired',
  });

  expect(mockAlertSink).toHaveBeenCalledWith(
    expect.objectContaining({
      level: 'critical',
    }),
  );
});

it('sends email when email notifications are enabled for intervention/failure events', async () => {
  await service.notify({
    taskName: '阿里云盘签到',
    status: 'failed',
    failureReason: 'api_request_failed',
  });

  expect(mockEmailNotifier.send).toHaveBeenCalled();
});
```

- [ ] **Step 2: Add a failing scheduler retry test**

Extend `tests/unit/services/SchedulerService.test.ts` with a case like:

```ts
it('can queue a delayed retry for a sign-in task without losing existing queue behavior', async () => {
  const service = new SchedulerService({
    taskService: mockTaskService as never,
    executeTask,
    maxConcurrency: 1,
    now: () => new Date('2026-04-28T09:00:00.000Z'),
    setTimer: fakeSetTimeout,
  });

  service.scheduleRetry('task-signin-1', 15_000);

  expect(fakeSetTimeout).toHaveBeenCalledWith(expect.any(Function), 15_000);
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
npx vitest run tests/unit/services/signin/NotificationService.test.ts tests/unit/services/SchedulerService.test.ts
```

Expected: FAIL because notification service and retry scheduling do not exist.

- [ ] **Step 4: Implement SMTP and notification abstractions**

Create `src/main/services/signin/EmailNotifier.ts` and `NotificationService.ts`.

`EmailNotifier` should expose:

```ts
send(input: {
  subject: string;
  text: string;
  config: EmailNotificationConfig;
}): Promise<void>
```

`NotificationService` should:

1. Always create an in-app alert for `needs_intervention` and `failed`.
2. Optionally create an alert for `api-fallback` success.
3. Read SMTP settings from `ConfigService`.
4. Send email only for configured critical events.

- [ ] **Step 5: Add sign-in orchestration service**

Create `src/main/services/signin/SigninTaskService.ts` with methods like:

```ts
runTask(taskId: string): Promise<SigninRunSummary>
markInterventionResolved(taskId: string): Promise<SigninRunSummary>
getLatestRun(taskId: string): SigninRunSummary | null
```

It should:

1. Load the `TaskFlow`.
2. Reject non-sign-in tasks.
3. Resolve the bound session partition using `SessionRegistry`.
4. Run `AliyunDriveSigninProvider`.
5. If provider returns `retry_scheduled`, hand off to `SchedulerService.scheduleRetry`.
6. If provider returns `needs_intervention`, create alert + remember state for UI.
7. If success/failure, notify via `NotificationService`.

Use in-memory latest run state first; postpone DB persistence of custom sign-in run history to a later phase unless the code reveals an obvious existing storage slot.

- [ ] **Step 6: Add retry scheduling primitives to `SchedulerService`**

Modify `src/main/services/SchedulerService.ts` to add injectable timer helpers:

```ts
setTimer?: typeof setTimeout;
clearTimer?: typeof clearTimeout;
now?: () => Date;
```

and a method:

```ts
scheduleRetry(taskId: string, delayMs: number): void
```

Keep it minimal:

- one timer per `taskId`
- reusing `triggerTask(taskId)` when the timer fires
- clearing retry timers on `stop()`

- [ ] **Step 7: Re-run tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit/services/signin/NotificationService.test.ts tests/unit/services/SchedulerService.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/services/signin/NotificationService.ts src/main/services/signin/EmailNotifier.ts src/main/services/signin/SigninTaskService.ts src/main/services/SchedulerService.ts src/main/services/AlertService.ts tests/unit/services/signin/NotificationService.test.ts tests/unit/services/SchedulerService.test.ts
git commit -m "feat: add sign-in orchestration and notifications"
```

## Task 4: Add IPC Channels and Main-Process Wiring

**Files:**
- Modify: `src/shared/constants/channels.ts`
- Create: `src/main/ipc/signin-handlers.ts`
- Modify: `src/main/app.ts`
- Test: `tests/unit/ipc/signin-handlers.spec.ts`

- [ ] **Step 1: Write failing IPC handler tests**

Create `tests/unit/ipc/signin-handlers.spec.ts` to verify channels:

```ts
it('registers sign-in handlers and forwards to SigninTaskService', async () => {
  registerSigninHandlers(controller, { signinTaskService });

  expect(controller.handle).toHaveBeenCalledWith(
    IPC_CHANNELS.SIGNIN_TASK_SAVE,
    expect.any(Function),
  );
  expect(controller.handle).toHaveBeenCalledWith(
    IPC_CHANNELS.SIGNIN_TASK_RUN_NOW,
    expect.any(Function),
  );
  expect(controller.handle).toHaveBeenCalledWith(
    IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY,
    expect.any(Function),
  );
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npx vitest run tests/unit/ipc/signin-handlers.spec.ts
```

Expected: FAIL because channels and handlers do not exist.

- [ ] **Step 3: Add new IPC channels**

Modify `src/shared/constants/channels.ts` to add:

```ts
SIGNIN_TASK_SAVE: 'signin:task:save',
SIGNIN_TASK_GET: 'signin:task:get',
SIGNIN_TASK_RUN_NOW: 'signin:task:runNow',
SIGNIN_TASK_INTERVENTION_RETRY: 'signin:task:interventionRetry',
SIGNIN_TASK_STATUS: 'signin:task:status',
SIGNIN_NOTIFICATION_TEST_EMAIL: 'signin:notification:testEmail',
```

- [ ] **Step 4: Implement sign-in IPC handlers**

Create `src/main/ipc/signin-handlers.ts` that:

1. Saves a sign-in task through `TaskService.createTask` / `TaskService.updateTaskFlow`.
2. Reads sign-in task detail.
3. Runs a task immediately through `SigninTaskService.runTask`.
4. Retries after manual intervention through `SigninTaskService.markInterventionResolved`.
5. Returns latest sign-in run summary.
6. Triggers a test email through `NotificationService`.

- [ ] **Step 5: Wire services in `src/main/app.ts`**

Add:

1. Construction of `SigninTaskService`.
2. Construction of `NotificationService` / `EmailNotifier`.
3. Registration of `signin-handlers`.
4. Optional scheduler execution hook:

```ts
executeTask: async (taskId) => {
  const task = this.taskService.getTaskDetail(taskId);
  if (task?.kind === 'aliyundrive-signin') {
    await this.signinTaskService.runTask(taskId);
    return;
  }
  await this.taskService.startTask(taskId, this.getTaskWebContents());
}
```

- [ ] **Step 6: Re-run tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit/ipc/signin-handlers.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/constants/channels.ts src/main/ipc/signin-handlers.ts src/main/app.ts tests/unit/ipc/signin-handlers.spec.ts
git commit -m "feat: wire sign-in services and IPC handlers"
```

## Task 5: Add Automation UI for Sign-In Task Setup and Run Status

**Files:**
- Create: `src/renderer/entries/automation/components/SigninTaskPanel.tsx`
- Create: `src/renderer/entries/automation/components/SigninRunStatusCard.tsx`
- Modify: `src/renderer/entries/automation/App.tsx`
- Test: `tests/unit/components/SigninTaskPanel.test.tsx`
- Test: `tests/unit/components/SigninRunStatusCard.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

Create `tests/unit/components/SigninTaskPanel.test.tsx`:

```tsx
it('submits a browser-first aliyundrive sign-in task with optional refresh token fallback', async () => {
  render(<SigninTaskPanel />);

  fireEvent.change(screen.getByLabelText('任务名称'), { target: { value: '阿里云盘签到' } });
  fireEvent.change(screen.getByLabelText('入口地址'), { target: { value: 'https://www.aliyundrive.com/' } });
  fireEvent.change(screen.getByLabelText('Refresh Token'), { target: { value: 'rt-demo' } });
  fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.SIGNIN_TASK_SAVE,
      expect.objectContaining({
        signin: expect.objectContaining({
          fallbackApiEnabled: true,
        }),
      }),
    );
  });
});
```

Create `tests/unit/components/SigninRunStatusCard.test.tsx`:

```tsx
it('renders intervention state and exposes retry CTA', async () => {
  render(<SigninRunStatusCard taskId="task-signin-1" />);

  expect(await screen.findByText('需要人工介入')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '处理完成，重试' }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY,
      { taskId: 'task-signin-1' },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npx vitest run tests/unit/components/SigninTaskPanel.test.tsx tests/unit/components/SigninRunStatusCard.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement `SigninTaskPanel`**

Create `src/renderer/entries/automation/components/SigninTaskPanel.tsx` with:

1. Task name.
2. Entry URL defaulting to `https://www.aliyundrive.com/`.
3. Session selector bound to `session:list`.
4. Fixed mode tag: `浏览器优先 / API 兜底`.
5. Refresh token input.
6. Max retry per day input.
7. Save button calling `signin:task:save`.
8. Optional run-now button calling `signin:task:runNow`.

- [ ] **Step 4: Implement `SigninRunStatusCard`**

Create `src/renderer/entries/automation/components/SigninRunStatusCard.tsx` that:

1. Polls or refreshes `signin:task:status`.
2. Displays status label, strategy used, retry count, failure reason, and detail text.
3. Shows “处理完成，重试” only in `needs_intervention`.
4. Shows a “立即执行” action for manual testing.

- [ ] **Step 5: Mount the new UI into automation page**

Modify `src/renderer/entries/automation/App.tsx` to:

1. Add `SigninTaskPanel` near task creation / task configuration.
2. Add `SigninRunStatusCard` under execution summary for the selected sign-in task.
3. Avoid showing sign-in-only panels for generic tasks.

- [ ] **Step 6: Re-run tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit/components/SigninTaskPanel.test.tsx tests/unit/components/SigninRunStatusCard.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/entries/automation/components/SigninTaskPanel.tsx src/renderer/entries/automation/components/SigninRunStatusCard.tsx src/renderer/entries/automation/App.tsx tests/unit/components/SigninTaskPanel.test.tsx tests/unit/components/SigninRunStatusCard.test.tsx
git commit -m "feat: add automation UI for sign-in tasks"
```

## Task 6: Add Notification Settings UI and Test Email Flow

**Files:**
- Modify: `src/renderer/entries/workbench/pages/Settings.tsx`
- Modify: `src/main/services/ConfigService.ts`
- Test: `tests/unit/components/Settings.test.tsx`

- [ ] **Step 1: Write failing settings tests**

Extend `tests/unit/components/Settings.test.tsx` with cases that:

```tsx
it('loads and saves SMTP notification settings inside general config', async () => {
  render(<Settings />);

  expect(await screen.findByLabelText('SMTP Host')).toBeDefined();
  fireEvent.change(screen.getByLabelText('SMTP Host'), { target: { value: 'smtp.example.com' } });
  fireEvent.click(screen.getByRole('button', { name: '保存设置' }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.CONFIG_SET,
      expect.objectContaining({
        key: 'general',
        value: expect.objectContaining({
          notificationEmail: expect.objectContaining({
            host: 'smtp.example.com',
          }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npx vitest run tests/unit/components/Settings.test.tsx
```

Expected: FAIL because the form does not include notification settings.

- [ ] **Step 3: Add defaults for notification email config**

Modify `src/main/services/ConfigService.ts` default general config to include an empty `notificationEmail` object:

```ts
notificationEmail: {
  enabled: false,
  host: '',
  port: 465,
  secure: true,
  username: '',
  password: '',
  from: '',
  to: [],
},
```

- [ ] **Step 4: Add SMTP settings UI**

Modify `src/renderer/entries/workbench/pages/Settings.tsx` to add a new inner card for:

1. Enable email notifications.
2. SMTP host.
3. SMTP port.
4. Secure switch.
5. Username.
6. Password.
7. From address.
8. To list.
9. “发送测试邮件” button calling `signin:notification:testEmail`.

Keep this in the existing `general` save path unless local code review reveals a stronger need to split config scopes.

- [ ] **Step 5: Re-run tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit/components/Settings.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/ConfigService.ts src/renderer/entries/workbench/pages/Settings.tsx tests/unit/components/Settings.test.tsx
git commit -m "feat: add notification email settings"
```

## Task 7: End-to-End Verification, Docs Sync, and Final Quality Checks

**Files:**
- Modify: `docs/overview/current-status.md`
- Modify: `docs/specs/automation-browser-ops-v1.md`
- Optional: `README.md` if user-facing entry points changed
- Test: `tests/e2e/automation-browser-ops.spec.ts`

- [ ] **Step 1: Add or extend E2E coverage for the sign-in task path**

Update `tests/e2e/automation-browser-ops.spec.ts` with a mocked sign-in task path that verifies:

1. Sign-in task panel renders.
2. Save action sends the right IPC call.
3. Run status card updates to `needs_intervention`.
4. Retry CTA dispatches `signin:task:interventionRetry`.

- [ ] **Step 2: Run the focused UI and service tests**

Run:

```bash
npx vitest run tests/unit/services/repositories/TaskRepository.test.ts tests/unit/services/TaskService.test.ts tests/unit/services/SchedulerService.test.ts tests/unit/services/signin/AliyunDriveApiFallback.test.ts tests/unit/services/signin/AliyunDriveSigninProvider.test.ts tests/unit/services/signin/NotificationService.test.ts tests/unit/ipc/signin-handlers.spec.ts tests/unit/components/SigninTaskPanel.test.tsx tests/unit/components/SigninRunStatusCard.test.tsx tests/unit/components/Settings.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the focused E2E test**

Run:

```bash
npx vitest run tests/e2e/automation-browser-ops.spec.ts
```

Expected: PASS if the test suite is Vitest-based; if this file is Playwright-driven in your repo, replace with the exact existing e2e command used for that file.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Re-read the approved design and sync docs**

Update:

1. `docs/overview/current-status.md` to mention the new AliyunDrive sign-in capability.
2. `docs/specs/automation-browser-ops-v1.md` to record actual implementation status of this single-site sign-in path.
3. `README.md` only if a user-visible entry point or setup step changed.

- [ ] **Step 6: Run the final verification bundle**

Run:

```bash
npx vitest run tests/unit/services/repositories/TaskRepository.test.ts tests/unit/services/TaskService.test.ts tests/unit/services/SchedulerService.test.ts tests/unit/services/signin/AliyunDriveApiFallback.test.ts tests/unit/services/signin/AliyunDriveSigninProvider.test.ts tests/unit/services/signin/NotificationService.test.ts tests/unit/ipc/signin-handlers.spec.ts tests/unit/components/SigninTaskPanel.test.tsx tests/unit/components/SigninRunStatusCard.test.tsx tests/unit/components/Settings.test.tsx tests/e2e/automation-browser-ops.spec.ts
npm run typecheck
```

Expected: PASS across all targeted checks.

- [ ] **Step 7: Commit**

```bash
git add docs/overview/current-status.md docs/specs/automation-browser-ops-v1.md README.md tests/e2e/automation-browser-ops.spec.ts
git commit -m "docs: sync aliyundrive sign-in status"
```
