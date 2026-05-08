# Remote Runner Control Plane V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable Remote Runner control-plane prototype for YClaw so the desktop app can connect to a runner, create remote tasks and sessions, dispatch executions, stream logs, cancel runs, and inspect results.

**Architecture:** Keep Desktop as the control plane and Remote Runner as the execution plane. Add shared protocol contracts first, then a main-process client/service layer, a minimal daemon for local integration, IPC handlers, and focused automation-module UI. Preserve the current local automation path and treat remote execution as an additional source.

**Tech Stack:** Electron 41, React 18, Vite 6, TypeScript 5.7, Node 20 `fetch`, better-sqlite3, zod, Vitest, Playwright

---

## Scope

This plan implements [docs/specs/remote-runner-control-plane-v1.md](../../specs/remote-runner-control-plane-v1.md) through a P0-first path:

| Phase | Outcome |
| --- | --- |
| Phase 1 | Shared types, constants, schemas, and error envelopes exist. |
| Phase 2 | Desktop can save Runner connections and probe health/capabilities. |
| Phase 3 | A minimal local Runner daemon supports task/session/execution APIs. |
| Phase 4 | Desktop can create remote tasks, dispatch runs, stream logs, cancel runs, and query summaries. |
| Phase 5 | Automation UI exposes the minimal remote workflow and e2e covers it. |

P1 items are included where they do not block the P0 path: remote sessions, retry metadata, result summaries, local/remote mappings, and minimal audit events.

## File Structure

| Area | Files |
| --- | --- |
| Shared protocol | `src/shared/types/remote-runner.ts`, `src/shared/constants/remote-runner.ts`, `src/shared/types/index.ts`, `src/shared/constants/index.ts`, `src/shared/constants/channels.ts` |
| Main remote client | `src/main/remote-runner/RemoteRunnerClient.ts`, `src/main/remote-runner/RemoteRunnerLogStream.ts`, `src/main/remote-runner/index.ts` |
| Persistence | `src/main/services/repositories/RemoteRunnerRepository.ts`, `src/main/services/RemoteRunnerService.ts`, `src/main/services/DatabaseService.ts` |
| IPC and app composition | `src/main/ipc/remote-runner-handlers.ts`, `src/main/app.ts`, `src/shared/constants/channels.ts` |
| Runner daemon | `src/runner/daemon/RemoteRunnerServer.ts`, `src/runner/daemon/InMemoryRemoteRunnerRuntime.ts`, `src/runner/daemon/index.ts`, `src/cli/yclaw.ts`, `scripts/yclaw.ts` |
| Renderer API and UI | `src/renderer/shared/api/remoteRunner.ts`, `src/renderer/entries/automation/components/RemoteRunnerPanel.tsx`, `src/renderer/entries/automation/components/RemoteExecutionDrawer.tsx`, `src/renderer/entries/automation/App.tsx` |
| Tests | `tests/unit/shared/remote-runner.spec.ts`, `tests/unit/services/RemoteRunnerClient.test.ts`, `tests/unit/services/RemoteRunnerService.test.ts`, `tests/unit/ipc/remote-runner-handlers.spec.ts`, `tests/unit/runner/remote-runner-server.spec.ts`, `tests/unit/components/RemoteRunnerPanel.test.tsx`, `tests/e2e/remote-runner-control-plane.spec.ts` |
| Docs | `docs/specs/remote-runner-control-plane-v1.md`, `docs/superpowers/plans/2026-04-20-remote-runner-control-plane-v1.md`, `docs/README.md` |

## Execution Rules

| Rule | Practice |
| --- | --- |
| Protect local flow | Every task must keep existing local task APIs and tests passing. |
| TDD | Write the focused failing test first, implement the smallest change, then run the targeted test. |
| Typed boundaries | Renderer and main process communicate only through typed IPC channels and shared contracts. |
| No token leakage | Test that Token values are not present in logs, errors, snapshots, or renderer-visible connection lists. |
| Protocol versioning | Every remote request/response path checks or carries `protocolVersion: 1`. |

### Task 1: Add Shared Remote Runner Contracts

**Files:**
- Create: `src/shared/types/remote-runner.ts`
- Create: `src/shared/constants/remote-runner.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/constants/index.ts`
- Modify: `src/shared/constants/channels.ts`
- Test: `tests/unit/shared/remote-runner.spec.ts`

- [ ] **Step 1: Write failing shared contract tests**

Create `tests/unit/shared/remote-runner.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  REMOTE_RUNNER_PROTOCOL_VERSION,
  REMOTE_RUNNER_STATUSES,
  sanitizeRunnerConnection,
  toRemoteRunnerError,
} from '@shared/constants/remote-runner';
import type { RunnerConnection, RemoteExecutionStatus } from '@shared/types/remote-runner';

describe('remote runner shared contract', () => {
  it('uses protocol version 1', () => {
    expect(REMOTE_RUNNER_PROTOCOL_VERSION).toBe(1);
  });

  it('contains every execution terminal and active status', () => {
    const statuses = REMOTE_RUNNER_STATUSES satisfies readonly RemoteExecutionStatus[];
    expect(statuses).toEqual([
      'queued',
      'running',
      'succeeded',
      'failed',
      'canceled',
      'timeout',
      'interrupted',
    ]);
  });

  it('sanitizes token references before returning connections to renderer', () => {
    const connection: RunnerConnection = {
      id: 'runner-local',
      name: 'Local Runner',
      baseUrl: 'http://127.0.0.1:7421',
      authType: 'token',
      tokenRef: 'secret-token-value',
      workspaceId: 'default',
      tlsMode: 'insecure-dev',
      proxyUrl: null,
      status: 'online',
      lastSeenAt: null,
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    };

    expect(sanitizeRunnerConnection(connection)).toEqual({
      ...connection,
      tokenRef: '***',
    });
  });

  it('normalizes unknown failures into runner_unavailable', () => {
    expect(toRemoteRunnerError(new Error('network down')).code).toBe('runner_unavailable');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run tests/unit/shared/remote-runner.spec.ts`

Expected: FAIL with missing `@shared/types/remote-runner` and `@shared/constants/remote-runner`.

- [ ] **Step 3: Add shared types**

Create `src/shared/types/remote-runner.ts` with the contract from the spec:

```ts
import type { TaskFlow, TaskStep } from './task';

export type RunnerConnectionStatus =
  | 'unknown'
  | 'online'
  | 'offline'
  | 'auth_failed'
  | 'incompatible';

export type RunnerTlsMode = 'strict' | 'insecure-dev';

export interface RunnerConnection {
  id: string;
  name: string;
  baseUrl: string;
  authType: 'token';
  tokenRef: string;
  workspaceId: string;
  tlsMode: RunnerTlsMode;
  proxyUrl: string | null;
  status: RunnerConnectionStatus;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RunnerCapability =
  | 'browser-automation'
  | 'screenshots'
  | 'downloads'
  | 'proxy'
  | 'headless'
  | 'headed'
  | 'sessions'
  | 'log-stream';

export interface RunnerLimits {
  maxConcurrency: number;
  maxTaskTimeoutMs: number;
  maxStepTimeoutMs: number;
  maxLogRetentionHours: number;
}

export interface RunnerInfo {
  runnerId: string;
  name: string;
  version: string;
  protocolVersion: 1;
  capabilities: RunnerCapability[];
  limits: RunnerLimits;
  serverTime: string;
}

export interface RunnerHealth {
  status: 'ok' | 'degraded' | 'down';
  queuedCount: number;
  runningCount: number;
  lastError: string | null;
  checkedAt: string;
}

export interface RemoteTask {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRevision {
  revisionId: string;
  taskId: string;
  revision: number;
  flow: TaskFlow;
  createdAt: string;
  createdBy: string;
}

export type RemoteSessionStatus = 'unknown' | 'valid' | 'expired' | 'refresh_required';

export interface RemoteSession {
  id: string;
  name: string;
  origin: string;
  status: RemoteSessionStatus;
  lastValidatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RemoteExecutionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'timeout'
  | 'interrupted';

export type RemoteFailureReason =
  | 'runner_unavailable'
  | 'auth_failed'
  | 'session_expired'
  | 'selector_not_found'
  | 'execution_timeout'
  | 'user_canceled'
  | 'unknown';

export interface RemoteResultSummary {
  itemCount: number;
  failedStepCount: number;
  screenshotCount: number;
  outputPreview: Record<string, unknown>[];
}

export interface RemoteExecution {
  id: string;
  taskId: string;
  revisionId: string;
  runnerId: string;
  status: RemoteExecutionStatus;
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledBy: string | null;
  failureReason: RemoteFailureReason | null;
  currentStepId: string | null;
  retryCount: number;
  resultSummary: RemoteResultSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteExecutionLog {
  id: string;
  executionId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stepId: string | null;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface CreateRemoteTaskRequest {
  name: string;
  description?: string;
  tags?: string[];
  flow: TaskFlow;
}

export interface UpdateRemoteTaskRequest extends CreateRemoteTaskRequest {
  enabled: boolean;
}

export interface CreateRemoteExecutionRequest {
  taskId: string;
  revisionId: string;
  sessionId?: string | null;
  timeoutMs?: number;
  retry?: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
  };
}

export interface RemoteStepProgress {
  step: TaskStep;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  startedAt: string | null;
  finishedAt: string | null;
  retryCount: number;
}

export interface RemoteRunnerErrorEnvelope {
  error: {
    code:
      | 'auth_failed'
      | 'workspace_forbidden'
      | 'protocol_incompatible'
      | 'runner_unavailable'
      | 'task_not_found'
      | 'revision_not_found'
      | 'session_expired'
      | 'execution_not_found'
      | 'execution_not_cancelable'
      | 'execution_timeout'
      | 'rate_limited';
    message: string;
    data?: Record<string, unknown>;
  };
}
```

- [ ] **Step 4: Add shared constants and sanitizers**

Create `src/shared/constants/remote-runner.ts`:

```ts
import type {
  RemoteExecutionStatus,
  RemoteRunnerErrorEnvelope,
  RunnerConnection,
} from '@shared/types/remote-runner';

export const REMOTE_RUNNER_PROTOCOL_VERSION = 1 as const;

export const REMOTE_RUNNER_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'canceled',
  'timeout',
  'interrupted',
] as const satisfies readonly RemoteExecutionStatus[];

export const REMOTE_RUNNER_API = {
  INFO: '/v1/runner/info',
  HEALTH: '/v1/runner/health',
  TASKS: '/v1/tasks',
  SESSIONS: '/v1/sessions',
  EXECUTIONS: '/v1/executions',
} as const;

export function sanitizeRunnerConnection(connection: RunnerConnection): RunnerConnection {
  return {
    ...connection,
    tokenRef: connection.tokenRef ? '***' : '',
  };
}

export function toRemoteRunnerError(error: unknown): RemoteRunnerErrorEnvelope['error'] {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const typed = error as RemoteRunnerErrorEnvelope['error'];
    return {
      code: typed.code,
      message: typed.message,
      data: typed.data,
    };
  }

  return {
    code: 'runner_unavailable',
    message: error instanceof Error ? error.message : String(error),
  };
}
```

- [ ] **Step 5: Export contracts and add IPC channel constants**

Modify `src/shared/types/index.ts`:

```ts
export * from './remote-runner';
```

Modify `src/shared/constants/index.ts`:

```ts
export * from './remote-runner';
```

Add to `IPC_CHANNELS` in `src/shared/constants/channels.ts`:

```ts
  // Remote Runner 控制面
  REMOTE_RUNNER_CONNECTION_LIST: 'runner:connection:list',
  REMOTE_RUNNER_CONNECTION_SAVE: 'runner:connection:save',
  REMOTE_RUNNER_CONNECTION_DELETE: 'runner:connection:delete',
  REMOTE_RUNNER_CONNECTION_TEST: 'runner:connection:test',
  REMOTE_RUNNER_TASK_LIST: 'runner:task:list',
  REMOTE_RUNNER_TASK_SAVE: 'runner:task:save',
  REMOTE_RUNNER_TASK_DELETE: 'runner:task:delete',
  REMOTE_RUNNER_SESSION_LIST: 'runner:session:list',
  REMOTE_RUNNER_SESSION_SAVE: 'runner:session:save',
  REMOTE_RUNNER_SESSION_DELETE: 'runner:session:delete',
  REMOTE_RUNNER_EXECUTION_START: 'runner:execution:start',
  REMOTE_RUNNER_EXECUTION_GET: 'runner:execution:get',
  REMOTE_RUNNER_EXECUTION_CANCEL: 'runner:execution:cancel',
  REMOTE_RUNNER_EXECUTION_LOGS: 'runner:execution:logs',
  REMOTE_RUNNER_LOG_EVENT: 'runner:log:event',
```

- [ ] **Step 6: Verify shared tests pass**

Run: `npx vitest run tests/unit/shared/remote-runner.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types/remote-runner.ts src/shared/constants/remote-runner.ts src/shared/types/index.ts src/shared/constants/index.ts src/shared/constants/channels.ts tests/unit/shared/remote-runner.spec.ts
git commit -m "feat: add remote runner shared contract"
```

### Task 2: Implement Remote Runner HTTP Client

**Files:**
- Create: `src/main/remote-runner/RemoteRunnerClient.ts`
- Create: `src/main/remote-runner/RemoteRunnerLogStream.ts`
- Create: `src/main/remote-runner/index.ts`
- Test: `tests/unit/services/RemoteRunnerClient.test.ts`

- [ ] **Step 1: Write failing client tests**

Create `tests/unit/services/RemoteRunnerClient.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { RemoteRunnerClient } from '@main/remote-runner';

describe('RemoteRunnerClient', () => {
  it('sends token, workspace, actor, and parses runner info', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        runnerId: 'runner-1',
        name: 'Runner 1',
        version: '1.0.0',
        protocolVersion: 1,
        capabilities: ['browser-automation', 'log-stream'],
        limits: {
          maxConcurrency: 2,
          maxTaskTimeoutMs: 300000,
          maxStepTimeoutMs: 30000,
          maxLogRetentionHours: 24,
        },
        serverTime: '2026-04-20T00:00:00.000Z',
      }),
    });

    const client = new RemoteRunnerClient({
      baseUrl: 'http://127.0.0.1:7421',
      token: 'secret',
      workspaceId: 'default',
      actorId: 'desktop',
      fetchImpl: fetchMock,
    });

    await expect(client.getInfo()).resolves.toMatchObject({ runnerId: 'runner-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:7421/v1/runner/info',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
          'X-YClaw-Workspace': 'default',
          'X-YClaw-Actor': 'desktop',
        }),
      }),
    );
  });

  it('maps error envelopes to thrown errors without leaking token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'auth_failed',
          message: 'Runner token is invalid',
        },
      }),
    });

    const client = new RemoteRunnerClient({
      baseUrl: 'http://127.0.0.1:7421/',
      token: 'secret-token-value',
      workspaceId: 'default',
      actorId: 'desktop',
      fetchImpl: fetchMock,
    });

    await expect(client.getInfo()).rejects.toMatchObject({
      code: 'auth_failed',
      message: 'Runner token is invalid',
    });
    await expect(client.getInfo()).rejects.not.toThrow('secret-token-value');
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npx vitest run tests/unit/services/RemoteRunnerClient.test.ts`

Expected: FAIL because `@main/remote-runner` does not exist.

- [ ] **Step 3: Implement `RemoteRunnerClient`**

Create `src/main/remote-runner/RemoteRunnerClient.ts`:

```ts
import type {
  CreateRemoteExecutionRequest,
  CreateRemoteTaskRequest,
  RemoteExecution,
  RemoteExecutionLog,
  RemoteRunnerErrorEnvelope,
  RemoteSession,
  RemoteTask,
  RunnerHealth,
  RunnerInfo,
  TaskRevision,
  UpdateRemoteTaskRequest,
} from '@shared/types/remote-runner';
import { REMOTE_RUNNER_API } from '@shared/constants/remote-runner';

type FetchLike = typeof fetch;

export class RemoteRunnerApiError extends Error {
  constructor(
    public readonly code: RemoteRunnerErrorEnvelope['error']['code'],
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RemoteRunnerApiError';
  }
}

export interface RemoteRunnerClientOptions {
  baseUrl: string;
  token: string;
  workspaceId: string;
  actorId: string;
  fetchImpl?: FetchLike;
}

export class RemoteRunnerClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly workspaceId: string;
  private readonly actorId: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: RemoteRunnerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.workspaceId = options.workspaceId;
    this.actorId = options.actorId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getInfo(): Promise<RunnerInfo> {
    return this.request<RunnerInfo>(REMOTE_RUNNER_API.INFO);
  }

  getHealth(): Promise<RunnerHealth> {
    return this.request<RunnerHealth>(REMOTE_RUNNER_API.HEALTH);
  }

  listTasks(): Promise<RemoteTask[]> {
    return this.request<RemoteTask[]>(REMOTE_RUNNER_API.TASKS);
  }

  createTask(payload: CreateRemoteTaskRequest): Promise<{ task: RemoteTask; revision: TaskRevision }> {
    return this.request(`${REMOTE_RUNNER_API.TASKS}`, { method: 'POST', body: payload });
  }

  updateTask(taskId: string, payload: UpdateRemoteTaskRequest): Promise<{ task: RemoteTask; revision: TaskRevision }> {
    return this.request(`${REMOTE_RUNNER_API.TASKS}/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: payload,
    });
  }

  deleteTask(taskId: string): Promise<{ ok: true }> {
    return this.request(`${REMOTE_RUNNER_API.TASKS}/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
  }

  listSessions(): Promise<RemoteSession[]> {
    return this.request<RemoteSession[]>(REMOTE_RUNNER_API.SESSIONS);
  }

  startExecution(payload: CreateRemoteExecutionRequest): Promise<RemoteExecution> {
    return this.request<RemoteExecution>(REMOTE_RUNNER_API.EXECUTIONS, { method: 'POST', body: payload });
  }

  getExecution(executionId: string): Promise<RemoteExecution> {
    return this.request<RemoteExecution>(`${REMOTE_RUNNER_API.EXECUTIONS}/${encodeURIComponent(executionId)}`);
  }

  cancelExecution(executionId: string): Promise<RemoteExecution> {
    return this.request<RemoteExecution>(
      `${REMOTE_RUNNER_API.EXECUTIONS}/${encodeURIComponent(executionId)}/cancel`,
      { method: 'POST' },
    );
  }

  getExecutionLogs(executionId: string): Promise<RemoteExecutionLog[]> {
    return this.request<RemoteExecutionLog[]>(
      `${REMOTE_RUNNER_API.EXECUTIONS}/${encodeURIComponent(executionId)}/logs`,
    );
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-YClaw-Workspace': this.workspaceId,
        'X-YClaw-Actor': this.actorId,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const envelope = payload as Partial<RemoteRunnerErrorEnvelope>;
      const error = envelope.error;
      throw new RemoteRunnerApiError(
        error?.code ?? 'runner_unavailable',
        error?.message ?? `Runner request failed with status ${response.status}`,
        error?.data,
      );
    }

    return payload as T;
  }
}
```

- [ ] **Step 4: Add log stream helper**

Create `src/main/remote-runner/RemoteRunnerLogStream.ts`:

```ts
import type { RemoteExecutionLog } from '@shared/types/remote-runner';

export function parseSseLogChunk(chunk: string): RemoteExecutionLog[] {
  return chunk
    .split('\n\n')
    .map((event) => event.trim())
    .filter(Boolean)
    .flatMap((event) => {
      const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) return [];
      return [JSON.parse(dataLine.slice('data:'.length).trim()) as RemoteExecutionLog];
    });
}
```

Create `src/main/remote-runner/index.ts`:

```ts
export * from './RemoteRunnerClient';
export * from './RemoteRunnerLogStream';
```

- [ ] **Step 5: Verify client tests pass**

Run: `npx vitest run tests/unit/services/RemoteRunnerClient.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/remote-runner tests/unit/services/RemoteRunnerClient.test.ts
git commit -m "feat: add remote runner client"
```

### Task 3: Persist Runner Connections and Probe Health

**Files:**
- Create: `src/main/services/repositories/RemoteRunnerRepository.ts`
- Create: `src/main/services/RemoteRunnerService.ts`
- Modify: `src/main/services/repositories/index.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Test: `tests/unit/services/RemoteRunnerService.test.ts`
- Test: `tests/unit/services/repositories/RemoteRunnerRepository.test.ts`

- [ ] **Step 1: Write failing service and repository tests**

Create `tests/unit/services/RemoteRunnerService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { RemoteRunnerService } from '@main/services/RemoteRunnerService';

describe('RemoteRunnerService', () => {
  it('saves connections and returns sanitized records', async () => {
    const repository = {
      list: vi.fn().mockReturnValue([]),
      save: vi.fn((connection) => connection),
      delete: vi.fn(),
      get: vi.fn(),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(),
      actorId: 'desktop',
    });

    const saved = await service.saveConnection({
      name: 'Local Runner',
      baseUrl: 'http://127.0.0.1:7421',
      token: 'secret-token-value',
      workspaceId: 'default',
      tlsMode: 'insecure-dev',
      proxyUrl: null,
    });

    expect(saved.tokenRef).toBe('***');
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ tokenRef: 'secret-token-value' }));
  });

  it('marks a connection online after successful probe', async () => {
    const repository = {
      list: vi.fn(),
      save: vi.fn((connection) => connection),
      delete: vi.fn(),
      get: vi.fn().mockReturnValue({
        id: 'runner-local',
        name: 'Local Runner',
        baseUrl: 'http://127.0.0.1:7421',
        authType: 'token',
        tokenRef: 'secret',
        workspaceId: 'default',
        tlsMode: 'insecure-dev',
        proxyUrl: null,
        status: 'unknown',
        lastSeenAt: null,
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      }),
    };
    const client = {
      getInfo: vi.fn().mockResolvedValue({ protocolVersion: 1, runnerId: 'runner-1' }),
      getHealth: vi.fn().mockResolvedValue({ status: 'ok', queuedCount: 0, runningCount: 0 }),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(() => client),
      actorId: 'desktop',
    });

    await expect(service.testConnection('runner-local')).resolves.toMatchObject({
      connection: expect.objectContaining({ status: 'online', tokenRef: '***' }),
      info: expect.objectContaining({ runnerId: 'runner-1' }),
    });
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npx vitest run tests/unit/services/RemoteRunnerService.test.ts`

Expected: FAIL because `RemoteRunnerService` does not exist.

- [ ] **Step 3: Add `RemoteRunnerService`**

Create `src/main/services/RemoteRunnerService.ts`:

```ts
import crypto from 'crypto';
import type { RunnerConnection, RunnerInfo, RunnerHealth } from '@shared/types/remote-runner';
import { REMOTE_RUNNER_PROTOCOL_VERSION, sanitizeRunnerConnection } from '@shared/constants/remote-runner';
import { RemoteRunnerClient } from '@main/remote-runner';

export interface SaveRunnerConnectionInput {
  id?: string;
  name: string;
  baseUrl: string;
  token: string;
  workspaceId: string;
  tlsMode: RunnerConnection['tlsMode'];
  proxyUrl: string | null;
}

export interface RemoteRunnerRepositoryLike {
  list(): RunnerConnection[];
  get(id: string): RunnerConnection | null;
  save(connection: RunnerConnection): RunnerConnection;
  delete(id: string): void;
}

export interface RemoteRunnerServiceOptions {
  repository: RemoteRunnerRepositoryLike;
  actorId: string;
  createClient?: (connection: RunnerConnection) => Pick<RemoteRunnerClient, 'getInfo' | 'getHealth'>;
}

export class RemoteRunnerService {
  private readonly repository: RemoteRunnerRepositoryLike;
  private readonly actorId: string;
  private readonly createClient: (connection: RunnerConnection) => Pick<RemoteRunnerClient, 'getInfo' | 'getHealth'>;

  constructor(options: RemoteRunnerServiceOptions) {
    this.repository = options.repository;
    this.actorId = options.actorId;
    this.createClient =
      options.createClient ??
      ((connection) =>
        new RemoteRunnerClient({
          baseUrl: connection.baseUrl,
          token: connection.tokenRef,
          workspaceId: connection.workspaceId,
          actorId: this.actorId,
        }));
  }

  listConnections(): RunnerConnection[] {
    return this.repository.list().map(sanitizeRunnerConnection);
  }

  async saveConnection(input: SaveRunnerConnectionInput): Promise<RunnerConnection> {
    const now = new Date().toISOString();
    const existing = input.id ? this.repository.get(input.id) : null;
    const connection: RunnerConnection = {
      id: existing?.id ?? input.id ?? crypto.randomUUID(),
      name: input.name.trim() || 'Remote Runner',
      baseUrl: input.baseUrl.replace(/\/+$/, ''),
      authType: 'token',
      tokenRef: input.token,
      workspaceId: input.workspaceId.trim() || 'default',
      tlsMode: input.tlsMode,
      proxyUrl: input.proxyUrl,
      status: existing?.status ?? 'unknown',
      lastSeenAt: existing?.lastSeenAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    return sanitizeRunnerConnection(this.repository.save(connection));
  }

  deleteConnection(id: string): void {
    this.repository.delete(id);
  }

  async testConnection(id: string): Promise<{
    connection: RunnerConnection;
    info: RunnerInfo;
    health: RunnerHealth;
  }> {
    const connection = this.requireConnection(id);
    const client = this.createClient(connection);
    const info = await client.getInfo();
    if (info.protocolVersion !== REMOTE_RUNNER_PROTOCOL_VERSION) {
      const updated = this.repository.save({
        ...connection,
        status: 'incompatible',
        updatedAt: new Date().toISOString(),
      });
      return {
        connection: sanitizeRunnerConnection(updated),
        info,
        health: {
          status: 'degraded',
          queuedCount: 0,
          runningCount: 0,
          lastError: 'protocol_incompatible',
          checkedAt: new Date().toISOString(),
        },
      };
    }

    const health = await client.getHealth();
    const updated = this.repository.save({
      ...connection,
      status: 'online',
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { connection: sanitizeRunnerConnection(updated), info, health };
  }

  private requireConnection(id: string): RunnerConnection {
    const connection = this.repository.get(id);
    if (!connection) {
      throw new Error(`Runner connection "${id}" not found`);
    }
    return connection;
  }
}
```

- [ ] **Step 4: Add repository and database table**

Create `src/main/services/repositories/RemoteRunnerRepository.ts` using the same constructor pattern as existing repositories:

```ts
import type { DatabaseService } from '../DatabaseService';
import type { RunnerConnection } from '@shared/types/remote-runner';

export class RemoteRunnerRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  list(): RunnerConnection[] {
    return this.databaseService
      .all<RunnerConnection>('SELECT * FROM remote_runner_connections ORDER BY updatedAt DESC')
      .map((row) => ({ ...row, proxyUrl: row.proxyUrl ?? null, lastSeenAt: row.lastSeenAt ?? null }));
  }

  get(id: string): RunnerConnection | null {
    const row = this.databaseService.get<RunnerConnection>(
      'SELECT * FROM remote_runner_connections WHERE id = ?',
      [id],
    );
    return row ? { ...row, proxyUrl: row.proxyUrl ?? null, lastSeenAt: row.lastSeenAt ?? null } : null;
  }

  save(connection: RunnerConnection): RunnerConnection {
    this.databaseService.run(
      `INSERT INTO remote_runner_connections
        (id, name, baseUrl, authType, tokenRef, workspaceId, tlsMode, proxyUrl, status, lastSeenAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        baseUrl = excluded.baseUrl,
        authType = excluded.authType,
        tokenRef = excluded.tokenRef,
        workspaceId = excluded.workspaceId,
        tlsMode = excluded.tlsMode,
        proxyUrl = excluded.proxyUrl,
        status = excluded.status,
        lastSeenAt = excluded.lastSeenAt,
        updatedAt = excluded.updatedAt`,
      [
        connection.id,
        connection.name,
        connection.baseUrl,
        connection.authType,
        connection.tokenRef,
        connection.workspaceId,
        connection.tlsMode,
        connection.proxyUrl,
        connection.status,
        connection.lastSeenAt,
        connection.createdAt,
        connection.updatedAt,
      ],
    );
    return connection;
  }

  delete(id: string): void {
    this.databaseService.run('DELETE FROM remote_runner_connections WHERE id = ?', [id]);
  }
}
```

Modify `src/main/services/DatabaseService.ts` migration setup to create `remote_runner_connections` with the columns used above.

- [ ] **Step 5: Export repository**

Modify `src/main/services/repositories/index.ts`:

```ts
export * from './RemoteRunnerRepository';
```

- [ ] **Step 6: Verify service and repository tests**

Run: `npx vitest run tests/unit/services/RemoteRunnerService.test.ts tests/unit/services/repositories/RemoteRunnerRepository.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/RemoteRunnerService.ts src/main/services/repositories/RemoteRunnerRepository.ts src/main/services/repositories/index.ts src/main/services/DatabaseService.ts tests/unit/services/RemoteRunnerService.test.ts tests/unit/services/repositories/RemoteRunnerRepository.test.ts
git commit -m "feat: persist remote runner connections"
```

### Task 4: Add Remote Runner IPC Handlers

**Files:**
- Create: `src/main/ipc/remote-runner-handlers.ts`
- Modify: `src/main/app.ts`
- Test: `tests/unit/ipc/remote-runner-handlers.spec.ts`
- Test: `tests/unit/services/AppComposition.test.ts`

- [ ] **Step 1: Write failing handler tests**

Create `tests/unit/ipc/remote-runner-handlers.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerRemoteRunnerHandlers } from '@main/ipc/remote-runner-handlers';

describe('registerRemoteRunnerHandlers', () => {
  it('registers connection and execution channels', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const service = {
      listConnections: vi.fn().mockReturnValue([]),
      saveConnection: vi.fn(),
      deleteConnection: vi.fn(),
      testConnection: vi.fn(),
      listRemoteTasks: vi.fn(),
      saveRemoteTask: vi.fn(),
      deleteRemoteTask: vi.fn(),
      listRemoteSessions: vi.fn(),
      saveRemoteSession: vi.fn(),
      deleteRemoteSession: vi.fn(),
      startExecution: vi.fn(),
      getExecution: vi.fn(),
      cancelExecution: vi.fn(),
      getExecutionLogs: vi.fn(),
    };

    registerRemoteRunnerHandlers({ ipcController, service });

    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST,
      expect.any(Function),
    );
    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_START,
      expect.any(Function),
    );
    await handlers.get(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST)?.({});
    expect(service.listConnections).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing handler tests**

Run: `npx vitest run tests/unit/ipc/remote-runner-handlers.spec.ts`

Expected: FAIL because the handler module does not exist.

- [ ] **Step 3: Implement handler registration**

Create `src/main/ipc/remote-runner-handlers.ts`:

```ts
import { IPC_CHANNELS } from '@shared/constants';

type IpcControllerLike = {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
};

type RemoteRunnerServiceLike = {
  listConnections(): unknown;
  saveConnection(payload: unknown): unknown;
  deleteConnection(id: string): unknown;
  testConnection(id: string): unknown;
  listRemoteTasks(payload: unknown): unknown;
  saveRemoteTask(payload: unknown): unknown;
  deleteRemoteTask(payload: unknown): unknown;
  listRemoteSessions(payload: unknown): unknown;
  saveRemoteSession(payload: unknown): unknown;
  deleteRemoteSession(payload: unknown): unknown;
  startExecution(payload: unknown): unknown;
  getExecution(payload: unknown): unknown;
  cancelExecution(payload: unknown): unknown;
  getExecutionLogs(payload: unknown): unknown;
};

export function registerRemoteRunnerHandlers(options: {
  ipcController: IpcControllerLike;
  service: RemoteRunnerServiceLike;
}): void {
  const { ipcController, service } = options;

  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST, () => service.listConnections());
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_SAVE, (payload) => service.saveConnection(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_DELETE, (payload) =>
    service.deleteConnection(assertId(payload)),
  );
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_TEST, (payload) =>
    service.testConnection(assertId(payload)),
  );
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_TASK_LIST, (payload) => service.listRemoteTasks(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_TASK_SAVE, (payload) => service.saveRemoteTask(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_TASK_DELETE, (payload) => service.deleteRemoteTask(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_SESSION_LIST, (payload) => service.listRemoteSessions(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_SESSION_SAVE, (payload) => service.saveRemoteSession(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_SESSION_DELETE, (payload) => service.deleteRemoteSession(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_START, (payload) => service.startExecution(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_GET, (payload) => service.getExecution(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_CANCEL, (payload) => service.cancelExecution(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_LOGS, (payload) => service.getExecutionLogs(payload));
}

function assertId(payload: unknown): string {
  if (typeof payload === 'string' && payload.length > 0) return payload;
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    typeof (payload as { id: unknown }).id === 'string'
  ) {
    return (payload as { id: string }).id;
  }
  throw new Error('id is required');
}
```

- [ ] **Step 4: Wire service into `App`**

Modify `src/main/app.ts`:

```ts
import { RemoteRunnerService } from './services/RemoteRunnerService';
import { RemoteRunnerRepository } from './services/repositories';
import { registerRemoteRunnerHandlers } from './ipc/remote-runner-handlers';
```

Add a private field:

```ts
private remoteRunnerService: RemoteRunnerService;
```

Instantiate after repositories:

```ts
const remoteRunnerRepository = new RemoteRunnerRepository(this.databaseService);
this.remoteRunnerService = new RemoteRunnerService({
  repository: remoteRunnerRepository,
  actorId: 'desktop',
});
```

Call inside `registerIpcHandlers()`:

```ts
registerRemoteRunnerHandlers({
  ipcController: this.ipcController,
  service: this.remoteRunnerService,
});
```

- [ ] **Step 5: Verify IPC and composition tests**

Run: `npx vitest run tests/unit/ipc/remote-runner-handlers.spec.ts tests/unit/services/AppComposition.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/remote-runner-handlers.ts src/main/app.ts tests/unit/ipc/remote-runner-handlers.spec.ts tests/unit/services/AppComposition.test.ts
git commit -m "feat: register remote runner ipc handlers"
```

### Task 5: Build Minimal Local Runner Daemon

**Files:**
- Create: `src/runner/daemon/InMemoryRemoteRunnerRuntime.ts`
- Create: `src/runner/daemon/RemoteRunnerServer.ts`
- Create: `src/runner/daemon/index.ts`
- Modify: `src/cli/yclaw.ts`
- Modify: `scripts/yclaw.ts`
- Test: `tests/unit/runner/remote-runner-server.spec.ts`
- Test: `tests/unit/cli/yclaw.spec.ts`

- [ ] **Step 1: Write failing daemon API tests**

Create `tests/unit/runner/remote-runner-server.spec.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { createRemoteRunnerServer } from '../../../src/runner/daemon';

describe('Remote Runner daemon', () => {
  const servers: Array<{ close(): Promise<void>; url: string }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  it('serves info, task creation, execution start, logs, and cancel', async () => {
    const server = await createRemoteRunnerServer({
      token: 'secret',
      workspaceId: 'default',
      port: 0,
    });
    servers.push(server);

    const headers = {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
      'X-YClaw-Workspace': 'default',
      'X-YClaw-Actor': 'test',
    };

    const info = await fetch(`${server.url}/v1/runner/info`, { headers }).then((res) => res.json());
    expect(info.protocolVersion).toBe(1);

    const created = await fetch(`${server.url}/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Remote smoke task',
        tags: [],
        flow: {
          id: 'flow-1',
          name: 'Remote smoke task',
          steps: [],
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      }),
    }).then((res) => res.json());

    const execution = await fetch(`${server.url}/v1/executions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        taskId: created.task.id,
        revisionId: created.revision.revisionId,
      }),
    }).then((res) => res.json());

    expect(execution.status).toBe('queued');

    const canceled = await fetch(`${server.url}/v1/executions/${execution.id}/cancel`, {
      method: 'POST',
      headers,
    }).then((res) => res.json());
    expect(canceled.status).toBe('canceled');
  });
});
```

- [ ] **Step 2: Run the failing daemon tests**

Run: `npx vitest run tests/unit/runner/remote-runner-server.spec.ts`

Expected: FAIL because `src/runner/daemon` exports do not exist yet.

- [ ] **Step 3: Implement in-memory runtime**

Create `src/runner/daemon/InMemoryRemoteRunnerRuntime.ts` with maps for tasks, revisions, sessions, executions, and logs. Use `crypto.randomUUID()` for IDs, return `queued` on execution creation, and allow cancel from `queued` or `running`.

Core methods:

```ts
createTask(payload: CreateRemoteTaskRequest): { task: RemoteTask; revision: TaskRevision }
updateTask(taskId: string, payload: UpdateRemoteTaskRequest): { task: RemoteTask; revision: TaskRevision }
listTasks(): RemoteTask[]
listSessions(): RemoteSession[]
startExecution(payload: CreateRemoteExecutionRequest, actorId: string): RemoteExecution
getExecution(executionId: string): RemoteExecution
cancelExecution(executionId: string, actorId: string): RemoteExecution
getExecutionLogs(executionId: string): RemoteExecutionLog[]
```

- [ ] **Step 4: Implement HTTP server**

Create `src/runner/daemon/RemoteRunnerServer.ts` using Node `http`:

```ts
import http from 'http';
import { InMemoryRemoteRunnerRuntime } from './InMemoryRemoteRunnerRuntime';

export interface RemoteRunnerServerOptions {
  token: string;
  workspaceId: string;
  port: number;
}

export async function createRemoteRunnerServer(options: RemoteRunnerServerOptions): Promise<{
  url: string;
  close(): Promise<void>;
}> {
  const runtime = new InMemoryRemoteRunnerRuntime();
  const server = http.createServer(async (request, response) => {
    await routeRequest({ request, response, runtime, options });
  });

  await new Promise<void>((resolve) => server.listen(options.port, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
```

Implement `routeRequest` with these exact paths:
- `GET /v1/runner/info`
- `GET /v1/runner/health`
- `GET /v1/tasks`
- `POST /v1/tasks`
- `PUT /v1/tasks/:taskId`
- `DELETE /v1/tasks/:taskId`
- `GET /v1/sessions`
- `POST /v1/executions`
- `GET /v1/executions/:executionId`
- `POST /v1/executions/:executionId/cancel`
- `GET /v1/executions/:executionId/logs`
- `GET /v1/executions/:executionId/logs/stream`

Authentication behavior:
- Missing or wrong `Authorization` returns `401` with `auth_failed`.
- Wrong `X-YClaw-Workspace` returns `403` with `workspace_forbidden`.

- [ ] **Step 5: Export daemon and add CLI command**

Create `src/runner/daemon/index.ts`:

```ts
export * from './RemoteRunnerServer';
export * from './InMemoryRemoteRunnerRuntime';
```

Modify `src/cli/yclaw.ts` to support:

```bash
npm run yclaw -- runner daemon --port 7421 --token dev-token --workspace default
```

The command prints:

```text
YClaw Remote Runner listening on http://127.0.0.1:7421
```

- [ ] **Step 6: Verify daemon and CLI tests**

Run: `npx vitest run tests/unit/runner/remote-runner-server.spec.ts tests/unit/cli/yclaw.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/runner/daemon src/cli/yclaw.ts scripts/yclaw.ts tests/unit/runner/remote-runner-server.spec.ts tests/unit/cli/yclaw.spec.ts
git commit -m "feat: add minimal remote runner daemon"
```

### Task 6: Add Renderer API and Runner Connection UI

**Files:**
- Create: `src/renderer/shared/api/remoteRunner.ts`
- Create: `src/renderer/entries/automation/components/RemoteRunnerPanel.tsx`
- Modify: `src/renderer/entries/automation/App.tsx`
- Test: `tests/unit/renderer/api/remoteRunner.spec.ts`
- Test: `tests/unit/components/RemoteRunnerPanel.test.tsx`

- [ ] **Step 1: Write failing renderer API tests**

Create `tests/unit/renderer/api/remoteRunner.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { createRemoteRunnerApi } from '@renderer/shared/api/remoteRunner';

describe('createRemoteRunnerApi', () => {
  it('invokes connection list channel', async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    const api = createRemoteRunnerApi({ invoke });
    await expect(api.listConnections()).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST);
  });
});
```

- [ ] **Step 2: Run the failing renderer tests**

Run: `npx vitest run tests/unit/renderer/api/remoteRunner.spec.ts`

Expected: FAIL because the renderer API module does not exist.

- [ ] **Step 3: Implement renderer API**

Create `src/renderer/shared/api/remoteRunner.ts`:

```ts
import { IPC_CHANNELS } from '@shared/constants';
import type { RunnerConnection } from '@shared/types/remote-runner';

type Invoke = (channel: string, payload?: unknown) => Promise<unknown>;

export function createRemoteRunnerApi(options: { invoke: Invoke }) {
  return {
    listConnections: () =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST) as Promise<RunnerConnection[]>,
    saveConnection: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_SAVE, payload) as Promise<RunnerConnection>,
    deleteConnection: (id: string) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_DELETE, { id }) as Promise<void>,
    testConnection: (id: string) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_TEST, { id }) as Promise<unknown>,
  };
}
```

- [ ] **Step 4: Build `RemoteRunnerPanel`**

Create `src/renderer/entries/automation/components/RemoteRunnerPanel.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, List, Select, Space, Tag } from 'antd';
import type { RunnerConnection } from '@shared/types/remote-runner';
import { createRemoteRunnerApi } from '@renderer/shared/api/remoteRunner';

export function RemoteRunnerPanel() {
  const [connections, setConnections] = useState<RunnerConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const api = useMemo(
    () =>
      createRemoteRunnerApi({
        invoke: window.electronAPI.invoke,
      }),
    [],
  );

  const refresh = async () => {
    setConnections(await api.listConnections());
  };

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const save = async (values: Record<string, unknown>) => {
    setError(null);
    await api.saveConnection(values);
    form.resetFields();
    await refresh();
  };

  return (
    <Card title="Remote Runner">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      <Form form={form} layout="inline" onFinish={save}>
        <Form.Item name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="名称" />
        </Form.Item>
        <Form.Item name="baseUrl" rules={[{ required: true, message: '请输入 Runner 地址' }]}>
          <Input placeholder="http://127.0.0.1:7421" />
        </Form.Item>
        <Form.Item name="token" rules={[{ required: true, message: '请输入 Token' }]}>
          <Input.Password placeholder="Token" />
        </Form.Item>
        <Form.Item name="workspaceId" initialValue="default">
          <Input placeholder="workspace" />
        </Form.Item>
        <Form.Item name="tlsMode" initialValue="insecure-dev">
          <Select
            style={{ width: 130 }}
            options={[
              { label: '严格 TLS', value: 'strict' },
              { label: '开发模式', value: 'insecure-dev' },
            ]}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          保存连接
        </Button>
      </Form>
      <List
        dataSource={connections}
        renderItem={(connection) => (
          <List.Item
            actions={[
              <Button key="test" onClick={() => api.testConnection(connection.id).then(refresh)}>
                测试
              </Button>,
            ]}
          >
            <Space>
              <strong>{connection.name}</strong>
              <span>{connection.baseUrl}</span>
              <Tag>{connection.status}</Tag>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}
```

- [ ] **Step 5: Mount panel in automation app**

Modify `src/renderer/entries/automation/App.tsx` to render `RemoteRunnerPanel` in a dedicated section or tab titled `远程 Runner`.

- [ ] **Step 6: Verify renderer tests**

Run: `npx vitest run tests/unit/renderer/api/remoteRunner.spec.ts tests/unit/components/RemoteRunnerPanel.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/shared/api/remoteRunner.ts src/renderer/entries/automation/components/RemoteRunnerPanel.tsx src/renderer/entries/automation/App.tsx tests/unit/renderer/api/remoteRunner.spec.ts tests/unit/components/RemoteRunnerPanel.test.tsx
git commit -m "feat: add remote runner connection ui"
```

### Task 7: Add Remote Task, Session, Execution, and Log Operations

**Files:**
- Modify: `src/main/services/RemoteRunnerService.ts`
- Modify: `src/main/remote-runner/RemoteRunnerClient.ts`
- Modify: `src/renderer/shared/api/remoteRunner.ts`
- Create: `src/renderer/entries/automation/components/RemoteExecutionDrawer.tsx`
- Modify: `src/renderer/entries/automation/components/RemoteRunnerPanel.tsx`
- Test: `tests/unit/services/RemoteRunnerService.test.ts`
- Test: `tests/unit/components/RemoteExecutionDrawer.test.tsx`

- [ ] **Step 1: Write failing execution service tests**

Extend `tests/unit/services/RemoteRunnerService.test.ts`:

```ts
it('starts execution through selected runner connection', async () => {
  const repository = {
    list: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    get: vi.fn().mockReturnValue({
      id: 'runner-local',
      name: 'Local Runner',
      baseUrl: 'http://127.0.0.1:7421',
      authType: 'token',
      tokenRef: 'secret',
      workspaceId: 'default',
      tlsMode: 'insecure-dev',
      proxyUrl: null,
      status: 'online',
      lastSeenAt: null,
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    }),
  };
  const client = {
    startExecution: vi.fn().mockResolvedValue({
      id: 'exec-1',
      taskId: 'task-1',
      revisionId: 'rev-1',
      status: 'queued',
    }),
  };

  const service = new RemoteRunnerService({
    repository,
    createClient: vi.fn(() => client),
    actorId: 'desktop',
  });

  await expect(
    service.startExecution({
      runnerConnectionId: 'runner-local',
      taskId: 'task-1',
      revisionId: 'rev-1',
    }),
  ).resolves.toMatchObject({ id: 'exec-1', status: 'queued' });
});
```

- [ ] **Step 2: Run the failing service tests**

Run: `npx vitest run tests/unit/services/RemoteRunnerService.test.ts`

Expected: FAIL because `startExecution` remote wrapper is not implemented.

- [ ] **Step 3: Add service wrappers**

Extend `RemoteRunnerService` with these methods:

```ts
listRemoteTasks(payload: { runnerConnectionId: string }): Promise<unknown> {
  return this.clientFor(payload.runnerConnectionId).listTasks();
}

saveRemoteTask(payload: { runnerConnectionId: string; taskId?: string; data: unknown }): Promise<unknown> {
  const client = this.clientFor(payload.runnerConnectionId);
  return payload.taskId
    ? client.updateTask(payload.taskId, payload.data as never)
    : client.createTask(payload.data as never);
}

deleteRemoteTask(payload: { runnerConnectionId: string; taskId: string }): Promise<unknown> {
  return this.clientFor(payload.runnerConnectionId).deleteTask(payload.taskId);
}

listRemoteSessions(payload: { runnerConnectionId: string }): Promise<unknown> {
  return this.clientFor(payload.runnerConnectionId).listSessions();
}

startExecution(payload: { runnerConnectionId: string; taskId: string; revisionId: string; sessionId?: string }): Promise<unknown> {
  return this.clientFor(payload.runnerConnectionId).startExecution(payload);
}

getExecution(payload: { runnerConnectionId: string; executionId: string }): Promise<unknown> {
  return this.clientFor(payload.runnerConnectionId).getExecution(payload.executionId);
}

cancelExecution(payload: { runnerConnectionId: string; executionId: string }): Promise<unknown> {
  return this.clientFor(payload.runnerConnectionId).cancelExecution(payload.executionId);
}

getExecutionLogs(payload: { runnerConnectionId: string; executionId: string }): Promise<unknown> {
  return this.clientFor(payload.runnerConnectionId).getExecutionLogs(payload.executionId);
}
```

Add private helper:

```ts
private clientFor(connectionId: string): RemoteRunnerClient {
  return this.createClient(this.requireConnection(connectionId)) as RemoteRunnerClient;
}
```

- [ ] **Step 4: Extend renderer API**

Add methods in `src/renderer/shared/api/remoteRunner.ts` for task/session/execution channels:

```ts
listRemoteTasks(payload: { runnerConnectionId: string })
saveRemoteTask(payload: unknown)
deleteRemoteTask(payload: unknown)
listRemoteSessions(payload: { runnerConnectionId: string })
startExecution(payload: unknown)
getExecution(payload: unknown)
cancelExecution(payload: unknown)
getExecutionLogs(payload: unknown)
```

- [ ] **Step 5: Add execution drawer UI**

Create `src/renderer/entries/automation/components/RemoteExecutionDrawer.tsx` with:
- Status tag
- Current step
- Retry count
- Realtime refresh button
- Cancel button
- Log list
- Result summary block

The cancel button calls `api.cancelExecution({ runnerConnectionId, executionId })` and refreshes execution detail.

- [ ] **Step 6: Verify service and component tests**

Run: `npx vitest run tests/unit/services/RemoteRunnerService.test.ts tests/unit/components/RemoteExecutionDrawer.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/RemoteRunnerService.ts src/main/remote-runner/RemoteRunnerClient.ts src/renderer/shared/api/remoteRunner.ts src/renderer/entries/automation/components/RemoteExecutionDrawer.tsx src/renderer/entries/automation/components/RemoteRunnerPanel.tsx tests/unit/services/RemoteRunnerService.test.ts tests/unit/components/RemoteExecutionDrawer.test.tsx
git commit -m "feat: manage remote tasks and executions"
```

### Task 8: Add End-to-End Remote Runner Smoke Flow

**Files:**
- Create: `tests/e2e/remote-runner-control-plane.spec.ts`
- Modify: `docs/specs/remote-runner-control-plane-v1.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Write e2e smoke test**

Create `tests/e2e/remote-runner-control-plane.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createRemoteRunnerServer } from '../../src/runner/daemon';

test.describe('Remote Runner control plane', () => {
  test('connects, tests runner, creates execution, and cancels it', async ({ page }) => {
    const server = await createRemoteRunnerServer({
      token: 'dev-token',
      workspaceId: 'default',
      port: 0,
    });

    try {
      await page.goto('/automation/index.html');
      await page.getByText('Remote Runner').click();
      await page.getByPlaceholder('名称').fill('E2E Runner');
      await page.getByPlaceholder('http://127.0.0.1:7421').fill(server.url);
      await page.getByPlaceholder('Token').fill('dev-token');
      await page.getByRole('button', { name: '保存连接' }).click();
      await expect(page.getByText('E2E Runner')).toBeVisible();
      await page.getByRole('button', { name: '测试' }).click();
      await expect(page.getByText('online')).toBeVisible();
    } finally {
      await server.close();
    }
  });
});
```

- [ ] **Step 2: Run focused e2e**

Run: `npm run test:e2e -- tests/e2e/remote-runner-control-plane.spec.ts`

Expected: PASS after Tasks 1-7 are complete.

- [ ] **Step 3: Update docs status**

Modify `docs/specs/remote-runner-control-plane-v1.md`:
- Mark completed P0 rows with implementation notes.
- Keep incomplete P1 rows as planned rows with explicit dependency.
- Add the e2e command under acceptance evidence.

Modify `docs/README.md`:
- Keep the spec link and plan link under §2.4.

- [ ] **Step 4: Run focused regression**

Run: `npx vitest run tests/unit/shared/remote-runner.spec.ts tests/unit/services/RemoteRunnerClient.test.ts tests/unit/services/RemoteRunnerService.test.ts tests/unit/ipc/remote-runner-handlers.spec.ts tests/unit/runner/remote-runner-server.spec.ts tests/unit/renderer/api/remoteRunner.spec.ts`

Expected: PASS.

- [ ] **Step 5: Run final gates**

Run: `npm run lint && npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/remote-runner-control-plane.spec.ts docs/specs/remote-runner-control-plane-v1.md docs/README.md
git commit -m "test: cover remote runner control plane smoke flow"
```

## Self-Review Checklist

- [ ] Spec coverage: RRC-P0-01 through RRC-P0-10 map to Tasks 1-8.
- [ ] P1 coverage: sessions, retry metadata, result summaries, mappings, and audit hooks are represented in contracts or service extensions.
- [ ] Security: token sanitization is tested in shared contract and service layers.
- [ ] Local regression: local task APIs are not replaced by remote APIs.
- [ ] Protocol consistency: every remote object uses `protocolVersion`, `workspaceId`, `runnerConnectionId`, or `revisionId` where appropriate.
- [ ] Verification: targeted unit tests, focused e2e, lint, typecheck, and full unit test commands are listed.
