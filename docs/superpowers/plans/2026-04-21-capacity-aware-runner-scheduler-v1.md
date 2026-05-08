# Capacity-Aware Runner Scheduler V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a capacity-aware scheduler that treats local and remote runners as one dispatch pool, queues work by task type, selects the lowest-score healthy runner, and safely reconciles orphaned executions.

**Architecture:** Add scheduler contracts first, then persistence, pure scoring, queueing, registry, lease reconciliation, dispatch adapters, IPC, and UI. Keep the existing Remote Runner control plane intact and route new scheduling behavior through additive services so local execution and direct remote execution remain testable while the scheduler matures.

**Tech Stack:** Electron 41, React 18, Vite 6, TypeScript 5.7, better-sqlite3, Vitest, Ant Design, existing `RemoteRunnerClient` / local automation services

---

## Scope

This plan implements [docs/specs/capacity-aware-runner-scheduler-v1.md](../../specs/capacity-aware-runner-scheduler-v1.md) as a P0-first vertical slice:

| Phase | Outcome |
| --- | --- |
| Phase 1 | Shared scheduler types, constants, IPC channels, and task metadata exist. |
| Phase 2 | SQLite migrations and repositories store runner nodes, queues, leases, health samples, and dispatch events. |
| Phase 3 | Pure scoring, registry, queue, lease, and reconcile services are unit-tested. |
| Phase 4 | Dispatch service can select local or remote adapters and create leases. |
| Phase 5 | IPC and automation UI expose the Runner 调度池 panel. |
| Phase 6 | Remote daemon can provide heartbeat metrics for the registry. |

## File Structure

| Area | Files |
| --- | --- |
| Shared contracts | `src/shared/types/runner-scheduler.ts`, `src/shared/constants/runner-scheduler.ts`, `src/shared/types/task.ts`, `src/shared/types/index.ts`, `src/shared/constants/index.ts`, `src/shared/constants/channels.ts` |
| Persistence | `src/main/services/repositories/RunnerSchedulerRepository.ts`, `src/main/services/DatabaseService.ts`, `src/main/services/repositories/index.ts` |
| Scheduler services | `src/main/services/runner-scheduler/CapacityScoringService.ts`, `RunnerRegistryService.ts`, `DispatchQueueService.ts`, `ExecutionLeaseService.ts`, `LeaseReconciler.ts`, `RunnerDispatchService.ts`, `RunnerAdapters.ts`, `index.ts` |
| IPC and app composition | `src/main/ipc/runner-scheduler-handlers.ts`, `src/main/app.ts` |
| Renderer API and UI | `src/renderer/shared/api/runnerScheduler.ts`, `src/renderer/entries/automation/components/RunnerSchedulerPanel.tsx`, `src/renderer/entries/automation/App.tsx` |
| Remote daemon metrics | `src/runner/daemon/RemoteRunnerServer.ts`, `src/runner/daemon/InMemoryRemoteRunnerRuntime.ts` |
| Tests | `tests/unit/shared/runner-scheduler.spec.ts`, `tests/unit/services/repositories/RunnerSchedulerRepository.test.ts`, `tests/unit/services/runner-scheduler/*.test.ts`, `tests/unit/ipc/runner-scheduler-handlers.spec.ts`, `tests/unit/renderer/api/runnerScheduler.spec.ts`, `tests/unit/components/RunnerSchedulerPanel.test.tsx`, `tests/unit/runner/remote-runner-server.spec.ts` |
| Docs | `docs/specs/capacity-aware-runner-scheduler-v1.md`, `docs/superpowers/plans/2026-04-21-capacity-aware-runner-scheduler-v1.md`, `docs/README.md` |

## Execution Rules

| Rule | Practice |
| --- | --- |
| TDD | Every task starts with a focused failing test and verifies red before implementation. |
| Additive design | Do not remove current local or remote execution paths; scheduler is additive until fully wired. |
| Pure core | Scoring and weighted round-robin must be deterministic pure logic with unit tests. |
| Safe recovery | Only `idempotent` queue items may auto-reassign; `unknown` is treated as non-idempotent. |
| Explainability | Dispatch events and score breakdowns must explain runner selection and filtering. |
| No background magic in tests | Tick loops must expose manual `tick()` / `reconcile()` methods and use intervals only at composition boundaries. |

---

### Task 1: Add Shared Scheduler Contracts

**Files:**
- Create: `src/shared/types/runner-scheduler.ts`
- Create: `src/shared/constants/runner-scheduler.ts`
- Modify: `src/shared/types/task.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/constants/index.ts`
- Modify: `src/shared/constants/channels.ts`
- Test: `tests/unit/shared/runner-scheduler.spec.ts`

- [ ] **Step 1: Write failing shared contract tests**

Create `tests/unit/shared/runner-scheduler.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants/channels';
import {
  DEFAULT_RUNNER_QUEUE_WEIGHTS,
  RUNNER_SCHEDULER_DEFAULTS,
  RUNNER_STATUSES,
} from '@shared/constants/runner-scheduler';
import type { RunnerStatus, QueueType, TaskIdempotency } from '@shared/types/runner-scheduler';

describe('runner scheduler shared contract', () => {
  it('defines runner states used by registry', () => {
    const statuses = RUNNER_STATUSES satisfies readonly RunnerStatus[];
    expect(statuses).toEqual(['online', 'degraded', 'offline', 'draining']);
  });

  it('uses inspect collect replay weighted queues', () => {
    const queueTypes: QueueType[] = ['inspect', 'collect', 'replay'];
    const idempotency: TaskIdempotency[] = ['idempotent', 'non-idempotent', 'unknown'];
    expect(queueTypes).toHaveLength(3);
    expect(idempotency).toContain('unknown');
    expect(DEFAULT_RUNNER_QUEUE_WEIGHTS).toEqual({ inspect: 4, collect: 3, replay: 1 });
  });

  it('sets safe default lease and heartbeat thresholds', () => {
    expect(RUNNER_SCHEDULER_DEFAULTS).toMatchObject({
      heartbeatIntervalMs: 10_000,
      heartbeatTimeoutMs: 30_000,
      leaseTtlMs: 45_000,
      orphanGraceMs: 60_000,
      maxReassignAttempts: 2,
    });
  });

  it('adds scheduler IPC channels using lowercase module naming', () => {
    expect(IPC_CHANNELS.RUNNER_REGISTRY_LIST).toBe('runner:registry:list');
    expect(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE).toBe('runner:queue:enqueue');
    expect(IPC_CHANNELS.RUNNER_LEASE_RECONCILE).toBe('runner:lease:reconcile');
  });
});
```

- [ ] **Step 2: Run failing shared test**

Run: `npx vitest run tests/unit/shared/runner-scheduler.spec.ts`

Expected: FAIL with missing `@shared/constants/runner-scheduler` and `@shared/types/runner-scheduler`.

- [ ] **Step 3: Add scheduler types**

Create `src/shared/types/runner-scheduler.ts`:

```ts
export type RunnerKind = 'local' | 'remote';
export type RunnerStatus = 'online' | 'degraded' | 'offline' | 'draining';
export type QueueType = 'inspect' | 'collect' | 'replay';
export type TaskIdempotency = 'idempotent' | 'non-idempotent' | 'unknown';
export type ExecutionPlacementStatus =
  | 'queued'
  | 'dispatching'
  | 'leased'
  | 'orphaned'
  | 'reassigning'
  | 'terminal'
  | 'cancelled';
export type ExecutionLeaseStatus = 'active' | 'expired' | 'released' | 'orphaned';
export type RunnerDispatchEventType =
  | 'enqueue'
  | 'dispatch'
  | 'lease_renew'
  | 'lease_release'
  | 'orphan'
  | 'reassign'
  | 'drain'
  | 'resume'
  | 'reject';

export interface RunnerNode {
  id: string;
  kind: RunnerKind;
  name: string;
  workspaceId: string;
  status: RunnerStatus;
  capabilities: string[];
  maxConcurrency: number;
  runningCount: number;
  cpuUsage: number;
  memoryUsage: number;
  heartbeatLatencyMs: number;
  recentFailureRate: number;
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunnerQueueItem {
  id: string;
  taskId: string;
  taskType: QueueType;
  idempotency: TaskIdempotency;
  workspaceId: string;
  status: ExecutionPlacementStatus;
  priority: number;
  reassignAttempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLease {
  id: string;
  executionId: string;
  queueItemId: string;
  runnerId: string;
  taskId: string;
  leaseToken: string;
  status: ExecutionLeaseStatus;
  expiresAt: string;
  lastRenewedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunnerHealthSample {
  id: string;
  runnerId: string;
  cpuUsage: number;
  memoryUsage: number;
  runningCount: number;
  maxConcurrency: number;
  heartbeatLatencyMs: number;
  recentFailureRate: number;
  sampledAt: string;
}

export interface RunnerDispatchEvent {
  id: string;
  eventType: RunnerDispatchEventType;
  runnerId: string | null;
  queueItemId: string | null;
  executionId: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RunnerScoreBreakdown {
  runnerId: string;
  score: number;
  capacityScore: number;
  resourceScore: number;
  latencyScore: number;
  failureScore: number;
  statusPenalty: number;
  filtered: boolean;
  reasons: string[];
}
```

- [ ] **Step 4: Add constants and IPC channels**

Create `src/shared/constants/runner-scheduler.ts`:

```ts
import type { QueueType, RunnerStatus } from '@shared/types/runner-scheduler';

export const RUNNER_STATUSES = ['online', 'degraded', 'offline', 'draining'] as const satisfies readonly RunnerStatus[];

export const DEFAULT_RUNNER_QUEUE_WEIGHTS = {
  inspect: 4,
  collect: 3,
  replay: 1,
} as const satisfies Record<QueueType, number>;

export const RUNNER_SCHEDULER_DEFAULTS = {
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  leaseTtlMs: 45_000,
  orphanGraceMs: 60_000,
  maxReassignAttempts: 2,
} as const;
```

Modify `src/shared/constants/channels.ts` inside `IPC_CHANNELS`:

```ts
  RUNNER_REGISTRY_LIST: 'runner:registry:list',
  RUNNER_REGISTRY_HEARTBEAT: 'runner:registry:heartbeat',
  RUNNER_REGISTRY_DRAIN: 'runner:registry:drain',
  RUNNER_REGISTRY_RESUME: 'runner:registry:resume',
  RUNNER_QUEUE_LIST: 'runner:queue:list',
  RUNNER_QUEUE_ENQUEUE: 'runner:queue:enqueue',
  RUNNER_QUEUE_CANCEL: 'runner:queue:cancel',
  RUNNER_DISPATCH_TICK: 'runner:dispatch:tick',
  RUNNER_LEASE_LIST: 'runner:lease:list',
  RUNNER_LEASE_RENEW: 'runner:lease:renew',
  RUNNER_LEASE_RELEASE: 'runner:lease:release',
  RUNNER_LEASE_RECONCILE: 'runner:lease:reconcile',
```

Modify `src/shared/types/index.ts`:

```ts
export type {
  RunnerKind,
  RunnerStatus,
  QueueType,
  TaskIdempotency,
  ExecutionPlacementStatus,
  ExecutionLeaseStatus,
  RunnerDispatchEventType,
  RunnerNode,
  RunnerQueueItem,
  ExecutionLease,
  RunnerHealthSample,
  RunnerDispatchEvent,
  RunnerScoreBreakdown,
} from './runner-scheduler';
```

Modify `src/shared/constants/index.ts`:

```ts
export {
  RUNNER_STATUSES,
  DEFAULT_RUNNER_QUEUE_WEIGHTS,
  RUNNER_SCHEDULER_DEFAULTS,
} from './runner-scheduler';
```

Extend task metadata in `src/shared/types/task.ts` without changing existing required fields:

```ts
import type { QueueType, TaskIdempotency } from './runner-scheduler';

export interface TaskSchedulingMetadata {
  taskType?: QueueType;
  idempotency?: TaskIdempotency;
  preferredRunnerKind?: 'local' | 'remote';
  requiredCapabilities?: string[];
}
```

If `Task` already has an extension point such as `metadata`, add `scheduling?: TaskSchedulingMetadata` there. If it does not, add optional `scheduling?: TaskSchedulingMetadata` to the task interface so existing data remains valid.

- [ ] **Step 5: Verify shared contracts pass**

Run: `npx vitest run tests/unit/shared/runner-scheduler.spec.ts tests/unit/shared/constants.test.ts`

Expected: PASS.

---

### Task 2: Add Database Migration and Repository

**Files:**
- Create: `src/main/services/repositories/RunnerSchedulerRepository.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/repositories/index.ts`
- Test: `tests/unit/services/repositories/RunnerSchedulerRepository.test.ts`

- [ ] **Step 1: Write failing repository test**

Create `tests/unit/services/repositories/RunnerSchedulerRepository.test.ts`:

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { RunnerSchedulerRepository } from '@main/services/repositories/RunnerSchedulerRepository';
import { DatabaseService } from '@main/services/DatabaseService';

describe('RunnerSchedulerRepository', () => {
  function createRepository() {
    const db = new Database(':memory:');
    new DatabaseService({ database: db }).migrate();
    return new RunnerSchedulerRepository(db);
  }

  it('saves and lists runner nodes', () => {
    const repository = createRepository();
    repository.saveRunnerNode({
      id: 'runner-local',
      kind: 'local',
      name: 'Local Runner',
      workspaceId: 'default',
      status: 'online',
      capabilities: ['browser-automation'],
      maxConcurrency: 2,
      runningCount: 0,
      cpuUsage: 0.1,
      memoryUsage: 0.2,
      heartbeatLatencyMs: 20,
      recentFailureRate: 0,
      lastHeartbeatAt: '2026-04-21T00:00:00.000Z',
      lastSeenAt: '2026-04-21T00:00:00.000Z',
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(repository.listRunnerNodes()).toHaveLength(1);
    expect(repository.listRunnerNodes()[0].capabilities).toEqual(['browser-automation']);
  });

  it('finds active leases that expired before a timestamp', () => {
    const repository = createRepository();
    repository.saveExecutionLease({
      id: 'lease-1',
      executionId: 'exec-1',
      queueItemId: 'queue-1',
      runnerId: 'runner-local',
      taskId: 'task-1',
      leaseToken: 'token-1',
      status: 'active',
      expiresAt: '2026-04-21T00:00:30.000Z',
      lastRenewedAt: '2026-04-21T00:00:00.000Z',
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(repository.listExpiredActiveLeases('2026-04-21T00:00:31.000Z')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run failing repository test**

Run: `npx vitest run tests/unit/services/repositories/RunnerSchedulerRepository.test.ts`

Expected: FAIL with missing repository or missing tables.

- [ ] **Step 3: Add migrations**

Modify `src/main/services/DatabaseService.ts` migration block to create tables from the spec. Use `CREATE TABLE IF NOT EXISTS` for:

```sql
CREATE TABLE IF NOT EXISTS runner_nodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL,
  running_count INTEGER NOT NULL,
  cpu_usage REAL NOT NULL,
  memory_usage REAL NOT NULL,
  heartbeat_latency_ms INTEGER NOT NULL,
  recent_failure_rate REAL NOT NULL,
  last_heartbeat_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runner_queue_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  idempotency TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  reassign_attempts INTEGER NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_leases (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  queue_item_id TEXT NOT NULL,
  runner_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  lease_token TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_renewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runner_health_samples (
  id TEXT PRIMARY KEY,
  runner_id TEXT NOT NULL,
  cpu_usage REAL NOT NULL,
  memory_usage REAL NOT NULL,
  running_count INTEGER NOT NULL,
  max_concurrency INTEGER NOT NULL,
  heartbeat_latency_ms INTEGER NOT NULL,
  recent_failure_rate REAL NOT NULL,
  sampled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runner_dispatch_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  runner_id TEXT,
  queue_item_id TEXT,
  execution_id TEXT,
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

Add indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_runner_nodes_workspace_status ON runner_nodes(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_runner_queue_items_type_status ON runner_queue_items(task_type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_leases_status_expires ON execution_leases(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_runner_dispatch_events_created ON runner_dispatch_events(created_at);
```

- [ ] **Step 4: Add repository implementation**

Create `src/main/services/repositories/RunnerSchedulerRepository.ts`:

```ts
import type Database from 'better-sqlite3';
import type {
  ExecutionLease,
  RunnerDispatchEvent,
  RunnerHealthSample,
  RunnerNode,
  RunnerQueueItem,
} from '@shared/types/runner-scheduler';

function parseJsonArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export class RunnerSchedulerRepository {
  constructor(private readonly database: Database.Database) {}

  saveRunnerNode(node: RunnerNode): RunnerNode {
    this.database.prepare(`
      INSERT INTO runner_nodes (
        id, kind, name, workspace_id, status, capabilities_json,
        max_concurrency, running_count, cpu_usage, memory_usage,
        heartbeat_latency_ms, recent_failure_rate, last_heartbeat_at,
        last_seen_at, created_at, updated_at
      ) VALUES (
        @id, @kind, @name, @workspaceId, @status, @capabilitiesJson,
        @maxConcurrency, @runningCount, @cpuUsage, @memoryUsage,
        @heartbeatLatencyMs, @recentFailureRate, @lastHeartbeatAt,
        @lastSeenAt, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        name = excluded.name,
        workspace_id = excluded.workspace_id,
        status = excluded.status,
        capabilities_json = excluded.capabilities_json,
        max_concurrency = excluded.max_concurrency,
        running_count = excluded.running_count,
        cpu_usage = excluded.cpu_usage,
        memory_usage = excluded.memory_usage,
        heartbeat_latency_ms = excluded.heartbeat_latency_ms,
        recent_failure_rate = excluded.recent_failure_rate,
        last_heartbeat_at = excluded.last_heartbeat_at,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    `).run({ ...node, capabilitiesJson: JSON.stringify(node.capabilities) });
    return node;
  }

  listRunnerNodes(): RunnerNode[] {
    return this.database.prepare('SELECT * FROM runner_nodes ORDER BY created_at ASC').all().map((row: any) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      workspaceId: row.workspace_id,
      status: row.status,
      capabilities: parseJsonArray(row.capabilities_json),
      maxConcurrency: row.max_concurrency,
      runningCount: row.running_count,
      cpuUsage: row.cpu_usage,
      memoryUsage: row.memory_usage,
      heartbeatLatencyMs: row.heartbeat_latency_ms,
      recentFailureRate: row.recent_failure_rate,
      lastHeartbeatAt: row.last_heartbeat_at,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  saveQueueItem(item: RunnerQueueItem): RunnerQueueItem {
    this.database.prepare(`
      INSERT INTO runner_queue_items (
        id, task_id, task_type, idempotency, workspace_id, status,
        priority, reassign_attempts, last_error, created_at, updated_at
      ) VALUES (
        @id, @taskId, @taskType, @idempotency, @workspaceId, @status,
        @priority, @reassignAttempts, @lastError, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        priority = excluded.priority,
        reassign_attempts = excluded.reassign_attempts,
        last_error = excluded.last_error,
        updated_at = excluded.updated_at
    `).run(item);
    return item;
  }

  listQueueItems(): RunnerQueueItem[] {
    return this.database.prepare('SELECT * FROM runner_queue_items ORDER BY created_at ASC').all().map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      taskType: row.task_type,
      idempotency: row.idempotency,
      workspaceId: row.workspace_id,
      status: row.status,
      priority: row.priority,
      reassignAttempts: row.reassign_attempts,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  saveExecutionLease(lease: ExecutionLease): ExecutionLease {
    this.database.prepare(`
      INSERT INTO execution_leases (
        id, execution_id, queue_item_id, runner_id, task_id, lease_token,
        status, expires_at, last_renewed_at, created_at, updated_at
      ) VALUES (
        @id, @executionId, @queueItemId, @runnerId, @taskId, @leaseToken,
        @status, @expiresAt, @lastRenewedAt, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        expires_at = excluded.expires_at,
        last_renewed_at = excluded.last_renewed_at,
        updated_at = excluded.updated_at
    `).run(lease);
    return lease;
  }

  listExpiredActiveLeases(nowIso: string): ExecutionLease[] {
    return this.database.prepare(`
      SELECT * FROM execution_leases
      WHERE status = 'active' AND expires_at < ?
      ORDER BY expires_at ASC
    `).all(nowIso).map((row: any) => ({
      id: row.id,
      executionId: row.execution_id,
      queueItemId: row.queue_item_id,
      runnerId: row.runner_id,
      taskId: row.task_id,
      leaseToken: row.lease_token,
      status: row.status,
      expiresAt: row.expires_at,
      lastRenewedAt: row.last_renewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  saveHealthSample(sample: RunnerHealthSample): RunnerHealthSample {
    this.database.prepare(`
      INSERT INTO runner_health_samples (
        id, runner_id, cpu_usage, memory_usage, running_count,
        max_concurrency, heartbeat_latency_ms, recent_failure_rate, sampled_at
      ) VALUES (
        @id, @runnerId, @cpuUsage, @memoryUsage, @runningCount,
        @maxConcurrency, @heartbeatLatencyMs, @recentFailureRate, @sampledAt
      )
    `).run(sample);
    return sample;
  }

  saveDispatchEvent(event: RunnerDispatchEvent): RunnerDispatchEvent {
    this.database.prepare(`
      INSERT INTO runner_dispatch_events (
        id, event_type, runner_id, queue_item_id, execution_id,
        message, metadata_json, created_at
      ) VALUES (
        @id, @eventType, @runnerId, @queueItemId, @executionId,
        @message, @metadataJson, @createdAt
      )
    `).run({ ...event, metadataJson: JSON.stringify(event.metadata) });
    return event;
  }
}
```

Modify `src/main/services/repositories/index.ts`:

```ts
export { RunnerSchedulerRepository } from './RunnerSchedulerRepository';
```

- [ ] **Step 5: Verify repository test passes**

Run: `npx vitest run tests/unit/services/repositories/RunnerSchedulerRepository.test.ts`

Expected: PASS.

---

### Task 3: Implement Capacity Scoring

**Files:**
- Create: `src/main/services/runner-scheduler/CapacityScoringService.ts`
- Create: `src/main/services/runner-scheduler/index.ts`
- Test: `tests/unit/services/runner-scheduler/CapacityScoringService.test.ts`

- [ ] **Step 1: Write failing scoring tests**

Create `tests/unit/services/runner-scheduler/CapacityScoringService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CapacityScoringService } from '@main/services/runner-scheduler/CapacityScoringService';
import type { RunnerNode } from '@shared/types';

function runner(overrides: Partial<RunnerNode>): RunnerNode {
  return {
    id: 'runner-a',
    kind: 'local',
    name: 'Runner A',
    workspaceId: 'default',
    status: 'online',
    capabilities: ['browser-automation'],
    maxConcurrency: 4,
    runningCount: 0,
    cpuUsage: 0.1,
    memoryUsage: 0.1,
    heartbeatLatencyMs: 10,
    recentFailureRate: 0,
    lastHeartbeatAt: '2026-04-21T00:00:00.000Z',
    lastSeenAt: '2026-04-21T00:00:00.000Z',
    createdAt: '2026-04-21T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('CapacityScoringService', () => {
  it('scores lower load runners lower', () => {
    const service = new CapacityScoringService();
    const low = service.score(runner({ id: 'low', runningCount: 1, maxConcurrency: 4 }));
    const high = service.score(runner({ id: 'high', runningCount: 3, maxConcurrency: 4 }));
    expect(low.score).toBeLessThan(high.score);
  });

  it('filters full and offline runners before dispatch', () => {
    const service = new CapacityScoringService();
    expect(service.score(runner({ runningCount: 4, maxConcurrency: 4 })).filtered).toBe(true);
    expect(service.score(runner({ status: 'offline' })).filtered).toBe(true);
  });

  it('adds degraded penalty but keeps runner schedulable', () => {
    const service = new CapacityScoringService();
    const online = service.score(runner({ id: 'online', status: 'online' }));
    const degraded = service.score(runner({ id: 'degraded', status: 'degraded' }));
    expect(degraded.filtered).toBe(false);
    expect(degraded.score).toBeGreaterThan(online.score);
  });
});
```

- [ ] **Step 2: Run failing scoring test**

Run: `npx vitest run tests/unit/services/runner-scheduler/CapacityScoringService.test.ts`

Expected: FAIL with missing `CapacityScoringService`.

- [ ] **Step 3: Add scoring service**

Create `src/main/services/runner-scheduler/CapacityScoringService.ts`:

```ts
import type { RunnerNode, RunnerScoreBreakdown } from '@shared/types';

export class CapacityScoringService {
  score(runner: RunnerNode): RunnerScoreBreakdown {
    const reasons: string[] = [];
    const filtered = this.isFiltered(runner, reasons);
    const capacityScore = runner.maxConcurrency <= 0 ? 1 : runner.runningCount / runner.maxConcurrency;
    const resourceScore = Math.max(runner.cpuUsage, runner.memoryUsage);
    const latencyScore = Math.min(runner.heartbeatLatencyMs / 5000, 1);
    const failureScore = runner.recentFailureRate;
    const statusPenalty = this.statusPenalty(runner.status);
    const score = filtered
      ? 999
      : capacityScore * 0.4 + resourceScore * 0.25 + latencyScore * 0.15 + failureScore * 0.2 + statusPenalty;

    if (!filtered) {
      reasons.push('schedulable');
    }

    return {
      runnerId: runner.id,
      score,
      capacityScore,
      resourceScore,
      latencyScore,
      failureScore,
      statusPenalty,
      filtered,
      reasons,
    };
  }

  selectBest(runners: RunnerNode[]): { runner: RunnerNode | null; breakdowns: RunnerScoreBreakdown[] } {
    const breakdowns = runners.map((runner) => this.score(runner));
    const candidates = runners
      .map((runner, index) => ({ runner, breakdown: breakdowns[index] }))
      .filter(({ breakdown }) => !breakdown.filtered)
      .sort((left, right) => left.breakdown.score - right.breakdown.score);
    return { runner: candidates[0]?.runner ?? null, breakdowns };
  }

  private isFiltered(runner: RunnerNode, reasons: string[]): boolean {
    if (runner.status === 'offline' || runner.status === 'draining') {
      reasons.push(`status:${runner.status}`);
      return true;
    }
    if (runner.runningCount >= runner.maxConcurrency) {
      reasons.push('capacity:full');
      return true;
    }
    return false;
  }

  private statusPenalty(status: RunnerNode['status']): number {
    if (status === 'degraded') return 0.5;
    if (status === 'offline' || status === 'draining') return 999;
    return 0;
  }
}
```

Create `src/main/services/runner-scheduler/index.ts`:

```ts
export { CapacityScoringService } from './CapacityScoringService';
```

- [ ] **Step 4: Verify scoring tests pass**

Run: `npx vitest run tests/unit/services/runner-scheduler/CapacityScoringService.test.ts`

Expected: PASS.

---

### Task 4: Implement Runner Registry

**Files:**
- Create: `src/main/services/runner-scheduler/RunnerRegistryService.ts`
- Modify: `src/main/services/runner-scheduler/index.ts`
- Test: `tests/unit/services/runner-scheduler/RunnerRegistryService.test.ts`

- [ ] **Step 1: Write failing registry tests**

Create `tests/unit/services/runner-scheduler/RunnerRegistryService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { RunnerRegistryService } from '@main/services/runner-scheduler/RunnerRegistryService';
import type { RunnerNode } from '@shared/types';

describe('RunnerRegistryService', () => {
  const now = new Date('2026-04-21T00:01:00.000Z');
  const repository = () => ({
    saveRunnerNode: vi.fn((node: RunnerNode) => node),
    listRunnerNodes: vi.fn(() => [] as RunnerNode[]),
    saveHealthSample: vi.fn(),
    saveDispatchEvent: vi.fn(),
  });

  it('registers local runner with online status', () => {
    const repo = repository();
    const service = new RunnerRegistryService({ repository: repo, now: () => now });
    const node = service.registerLocalRunner({ id: 'local', name: 'Local', workspaceId: 'default', maxConcurrency: 2 });
    expect(node.status).toBe('online');
    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'local', kind: 'local' }));
  });

  it('marks stale runners offline during health tick', () => {
    const stale = {
      id: 'remote', kind: 'remote', name: 'Remote', workspaceId: 'default', status: 'online',
      capabilities: [], maxConcurrency: 1, runningCount: 0, cpuUsage: 0, memoryUsage: 0,
      heartbeatLatencyMs: 0, recentFailureRate: 0,
      lastHeartbeatAt: '2026-04-21T00:00:00.000Z', lastSeenAt: '2026-04-21T00:00:00.000Z',
      createdAt: '2026-04-21T00:00:00.000Z', updatedAt: '2026-04-21T00:00:00.000Z',
    } as RunnerNode;
    const repo = repository();
    repo.listRunnerNodes.mockReturnValue([stale]);
    const service = new RunnerRegistryService({ repository: repo, now: () => now });
    service.healthTick();
    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'remote', status: 'offline' }));
  });
});
```

- [ ] **Step 2: Run failing registry test**

Run: `npx vitest run tests/unit/services/runner-scheduler/RunnerRegistryService.test.ts`

Expected: FAIL with missing `RunnerRegistryService`.

- [ ] **Step 3: Add registry service**

Create `src/main/services/runner-scheduler/RunnerRegistryService.ts`:

```ts
import crypto from 'crypto';
import { RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';
import type { RunnerDispatchEvent, RunnerHealthSample, RunnerNode } from '@shared/types';

interface RepositoryLike {
  saveRunnerNode(node: RunnerNode): RunnerNode;
  listRunnerNodes(): RunnerNode[];
  saveHealthSample(sample: RunnerHealthSample): RunnerHealthSample;
  saveDispatchEvent(event: RunnerDispatchEvent): RunnerDispatchEvent;
}

interface RegisterLocalRunnerInput {
  id: string;
  name: string;
  workspaceId: string;
  maxConcurrency: number;
}

export class RunnerRegistryService {
  constructor(private readonly options: { repository: RepositoryLike; now?: () => Date }) {}

  registerLocalRunner(input: RegisterLocalRunnerInput): RunnerNode {
    const timestamp = this.nowIso();
    return this.options.repository.saveRunnerNode({
      id: input.id,
      kind: 'local',
      name: input.name,
      workspaceId: input.workspaceId,
      status: 'online',
      capabilities: ['browser-automation', 'sessions'],
      maxConcurrency: input.maxConcurrency,
      runningCount: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      heartbeatLatencyMs: 0,
      recentFailureRate: 0,
      lastHeartbeatAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  heartbeat(runnerId: string, metrics: Partial<Pick<RunnerNode, 'runningCount' | 'cpuUsage' | 'memoryUsage' | 'heartbeatLatencyMs' | 'recentFailureRate'>>): RunnerNode | null {
    const current = this.options.repository.listRunnerNodes().find((node) => node.id === runnerId);
    if (!current) return null;
    const timestamp = this.nowIso();
    const next: RunnerNode = {
      ...current,
      ...metrics,
      status: this.deriveStatus({ ...current, ...metrics }),
      lastHeartbeatAt: timestamp,
      lastSeenAt: timestamp,
      updatedAt: timestamp,
    };
    this.options.repository.saveRunnerNode(next);
    this.options.repository.saveHealthSample(this.toHealthSample(next, timestamp));
    return next;
  }

  healthTick(): RunnerNode[] {
    const now = this.options.now?.() ?? new Date();
    return this.options.repository.listRunnerNodes().map((node) => {
      const lastHeartbeat = node.lastHeartbeatAt ? new Date(node.lastHeartbeatAt).getTime() : 0;
      const stale = now.getTime() - lastHeartbeat > RUNNER_SCHEDULER_DEFAULTS.heartbeatTimeoutMs;
      const status = stale ? 'offline' : this.deriveStatus(node);
      const next = { ...node, status, updatedAt: now.toISOString() };
      if (next.status !== node.status) {
        this.options.repository.saveDispatchEvent({
          id: crypto.randomUUID(),
          eventType: status === 'offline' ? 'reject' : 'resume',
          runnerId: node.id,
          queueItemId: null,
          executionId: null,
          message: `Runner ${node.id} changed to ${status}`,
          metadata: { previousStatus: node.status, status },
          createdAt: now.toISOString(),
        });
      }
      this.options.repository.saveRunnerNode(next);
      this.options.repository.saveHealthSample(this.toHealthSample(next, now.toISOString()));
      return next;
    });
  }

  drain(runnerId: string): RunnerNode | null {
    return this.setStatus(runnerId, 'draining');
  }

  resume(runnerId: string): RunnerNode | null {
    return this.setStatus(runnerId, 'online');
  }

  listSchedulable(workspaceId: string): RunnerNode[] {
    return this.options.repository.listRunnerNodes().filter((node) => node.workspaceId === workspaceId);
  }

  private setStatus(runnerId: string, status: RunnerNode['status']): RunnerNode | null {
    const current = this.options.repository.listRunnerNodes().find((node) => node.id === runnerId);
    if (!current) return null;
    const next = { ...current, status, updatedAt: this.nowIso() };
    return this.options.repository.saveRunnerNode(next);
  }

  private deriveStatus(node: Pick<RunnerNode, 'cpuUsage' | 'memoryUsage' | 'recentFailureRate' | 'status'>): RunnerNode['status'] {
    if (node.status === 'draining' || node.status === 'offline') return node.status;
    if (node.cpuUsage >= 0.9 || node.memoryUsage >= 0.9 || node.recentFailureRate >= 0.5) return 'degraded';
    return 'online';
  }

  private toHealthSample(node: RunnerNode, sampledAt: string): RunnerHealthSample {
    return {
      id: crypto.randomUUID(),
      runnerId: node.id,
      cpuUsage: node.cpuUsage,
      memoryUsage: node.memoryUsage,
      runningCount: node.runningCount,
      maxConcurrency: node.maxConcurrency,
      heartbeatLatencyMs: node.heartbeatLatencyMs,
      recentFailureRate: node.recentFailureRate,
      sampledAt,
    };
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}
```

Modify `src/main/services/runner-scheduler/index.ts`:

```ts
export { RunnerRegistryService } from './RunnerRegistryService';
```

- [ ] **Step 4: Verify registry tests pass**

Run: `npx vitest run tests/unit/services/runner-scheduler/RunnerRegistryService.test.ts`

Expected: PASS.

---

### Task 5: Implement Dispatch Queue Weighted Round Robin

**Files:**
- Create: `src/main/services/runner-scheduler/DispatchQueueService.ts`
- Modify: `src/main/services/runner-scheduler/index.ts`
- Test: `tests/unit/services/runner-scheduler/DispatchQueueService.test.ts`

- [ ] **Step 1: Write failing queue tests**

Create `tests/unit/services/runner-scheduler/DispatchQueueService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DispatchQueueService } from '@main/services/runner-scheduler/DispatchQueueService';
import type { RunnerQueueItem } from '@shared/types';

function item(id: string, taskType: RunnerQueueItem['taskType']): RunnerQueueItem {
  return {
    id,
    taskId: `task-${id}`,
    taskType,
    idempotency: 'idempotent',
    workspaceId: 'default',
    status: 'queued',
    priority: 0,
    reassignAttempts: 0,
    lastError: null,
    createdAt: `2026-04-21T00:00:0${id}.000Z`,
    updatedAt: `2026-04-21T00:00:0${id}.000Z`,
  };
}

describe('DispatchQueueService', () => {
  it('selects queues by weighted round robin', () => {
    const repository = {
      listQueueItems: vi.fn(() => [item('1', 'inspect'), item('2', 'collect'), item('3', 'replay')]),
      saveQueueItem: vi.fn((queueItem: RunnerQueueItem) => queueItem),
    };
    const service = new DispatchQueueService({ repository });

    expect(service.peekNext()?.taskType).toBe('inspect');
    service.advanceCursor();
    expect(service.peekNext()?.taskType).toBe('inspect');
    service.advanceCursor();
    service.advanceCursor();
    service.advanceCursor();
    expect(service.peekNext()?.taskType).toBe('collect');
  });

  it('keeps an item queued when no runner is available', () => {
    const queueItem = item('1', 'inspect');
    const repository = {
      listQueueItems: vi.fn(() => [queueItem]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({ repository });
    expect(service.peekNext()).toEqual(queueItem);
    expect(repository.saveQueueItem).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing queue test**

Run: `npx vitest run tests/unit/services/runner-scheduler/DispatchQueueService.test.ts`

Expected: FAIL with missing service.

- [ ] **Step 3: Add queue service**

Create `src/main/services/runner-scheduler/DispatchQueueService.ts`:

```ts
import crypto from 'crypto';
import { DEFAULT_RUNNER_QUEUE_WEIGHTS } from '@shared/constants';
import type { QueueType, RunnerQueueItem, TaskIdempotency } from '@shared/types';

interface RepositoryLike {
  listQueueItems(): RunnerQueueItem[];
  saveQueueItem(item: RunnerQueueItem): RunnerQueueItem;
}

export class DispatchQueueService {
  private cursor = 0;
  private readonly sequence: QueueType[];

  constructor(private readonly options: { repository: RepositoryLike; now?: () => Date; weights?: Record<QueueType, number> }) {
    this.sequence = this.buildSequence(options.weights ?? DEFAULT_RUNNER_QUEUE_WEIGHTS);
  }

  enqueue(input: { taskId: string; taskType: QueueType; idempotency: TaskIdempotency; workspaceId: string; priority?: number }): RunnerQueueItem {
    const timestamp = (this.options.now?.() ?? new Date()).toISOString();
    return this.options.repository.saveQueueItem({
      id: crypto.randomUUID(),
      taskId: input.taskId,
      taskType: input.taskType,
      idempotency: input.idempotency,
      workspaceId: input.workspaceId,
      status: 'queued',
      priority: input.priority ?? 0,
      reassignAttempts: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  peekNext(): RunnerQueueItem | null {
    for (let offset = 0; offset < this.sequence.length; offset += 1) {
      const queueType = this.sequence[(this.cursor + offset) % this.sequence.length];
      const item = this.firstQueuedOfType(queueType);
      if (item) return item;
    }
    return null;
  }

  markDispatching(item: RunnerQueueItem): RunnerQueueItem {
    return this.options.repository.saveQueueItem({
      ...item,
      status: 'dispatching',
      updatedAt: (this.options.now?.() ?? new Date()).toISOString(),
    });
  }

  advanceCursor(): void {
    this.cursor = (this.cursor + 1) % this.sequence.length;
  }

  private firstQueuedOfType(queueType: QueueType): RunnerQueueItem | null {
    return this.options.repository
      .listQueueItems()
      .filter((item) => item.status === 'queued' && item.taskType === queueType)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] ?? null;
  }

  private buildSequence(weights: Record<QueueType, number>): QueueType[] {
    return (Object.entries(weights) as Array<[QueueType, number]>).flatMap(([queueType, weight]) =>
      Array.from({ length: weight }, () => queueType),
    );
  }
}
```

Modify `src/main/services/runner-scheduler/index.ts`:

```ts
export { DispatchQueueService } from './DispatchQueueService';
```

- [ ] **Step 4: Verify queue tests pass**

Run: `npx vitest run tests/unit/services/runner-scheduler/DispatchQueueService.test.ts`

Expected: PASS.

---

### Task 6: Implement Execution Lease and Reconciler

**Files:**
- Create: `src/main/services/runner-scheduler/ExecutionLeaseService.ts`
- Create: `src/main/services/runner-scheduler/LeaseReconciler.ts`
- Modify: `src/main/services/runner-scheduler/index.ts`
- Test: `tests/unit/services/runner-scheduler/ExecutionLeaseService.test.ts`
- Test: `tests/unit/services/runner-scheduler/LeaseReconciler.test.ts`

- [ ] **Step 1: Write failing lease tests**

Create `tests/unit/services/runner-scheduler/ExecutionLeaseService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ExecutionLeaseService } from '@main/services/runner-scheduler/ExecutionLeaseService';

describe('ExecutionLeaseService', () => {
  it('creates an active lease with configured ttl', () => {
    const repository = { saveExecutionLease: vi.fn((lease) => lease) };
    const service = new ExecutionLeaseService({
      repository,
      now: () => new Date('2026-04-21T00:00:00.000Z'),
      leaseTtlMs: 45_000,
    });
    const lease = service.createLease({ executionId: 'exec-1', queueItemId: 'queue-1', runnerId: 'runner-1', taskId: 'task-1' });
    expect(lease.status).toBe('active');
    expect(lease.expiresAt).toBe('2026-04-21T00:00:45.000Z');
  });
});
```

Create `tests/unit/services/runner-scheduler/LeaseReconciler.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { LeaseReconciler } from '@main/services/runner-scheduler/LeaseReconciler';
import type { ExecutionLease, RunnerQueueItem } from '@shared/types';

const lease: ExecutionLease = {
  id: 'lease-1', executionId: 'exec-1', queueItemId: 'queue-1', runnerId: 'runner-1', taskId: 'task-1',
  leaseToken: 'token', status: 'active', expiresAt: '2026-04-21T00:00:30.000Z',
  lastRenewedAt: '2026-04-21T00:00:00.000Z', createdAt: '2026-04-21T00:00:00.000Z', updatedAt: '2026-04-21T00:00:00.000Z',
};
const queueItem = (idempotency: RunnerQueueItem['idempotency']): RunnerQueueItem => ({
  id: 'queue-1', taskId: 'task-1', taskType: 'collect', idempotency, workspaceId: 'default',
  status: 'leased', priority: 0, reassignAttempts: 0, lastError: null,
  createdAt: '2026-04-21T00:00:00.000Z', updatedAt: '2026-04-21T00:00:00.000Z',
});

describe('LeaseReconciler', () => {
  it('requeues idempotent orphaned work', () => {
    const repository = {
      listExpiredActiveLeases: vi.fn(() => [lease]),
      listQueueItems: vi.fn(() => [queueItem('idempotent')]),
      saveExecutionLease: vi.fn((next) => next),
      saveQueueItem: vi.fn((next) => next),
      saveDispatchEvent: vi.fn((event) => event),
    };
    const reconciler = new LeaseReconciler({ repository, now: () => new Date('2026-04-21T00:02:00.000Z') });
    reconciler.reconcile();
    expect(repository.saveQueueItem).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued', reassignAttempts: 1 }));
  });

  it('does not requeue unknown idempotency', () => {
    const repository = {
      listExpiredActiveLeases: vi.fn(() => [lease]),
      listQueueItems: vi.fn(() => [queueItem('unknown')]),
      saveExecutionLease: vi.fn((next) => next),
      saveQueueItem: vi.fn((next) => next),
      saveDispatchEvent: vi.fn((event) => event),
    };
    const reconciler = new LeaseReconciler({ repository, now: () => new Date('2026-04-21T00:02:00.000Z') });
    reconciler.reconcile();
    expect(repository.saveQueueItem).toHaveBeenCalledWith(expect.objectContaining({ status: 'terminal' }));
  });
});
```

- [ ] **Step 2: Run failing lease tests**

Run: `npx vitest run tests/unit/services/runner-scheduler/ExecutionLeaseService.test.ts tests/unit/services/runner-scheduler/LeaseReconciler.test.ts`

Expected: FAIL with missing services.

- [ ] **Step 3: Add lease service**

Create `src/main/services/runner-scheduler/ExecutionLeaseService.ts`:

```ts
import crypto from 'crypto';
import { RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';
import type { ExecutionLease } from '@shared/types';

interface RepositoryLike {
  saveExecutionLease(lease: ExecutionLease): ExecutionLease;
}

export class ExecutionLeaseService {
  constructor(private readonly options: { repository: RepositoryLike; now?: () => Date; leaseTtlMs?: number }) {}

  createLease(input: { executionId: string; queueItemId: string; runnerId: string; taskId: string }): ExecutionLease {
    const now = this.options.now?.() ?? new Date();
    const ttl = this.options.leaseTtlMs ?? RUNNER_SCHEDULER_DEFAULTS.leaseTtlMs;
    const lease: ExecutionLease = {
      id: crypto.randomUUID(),
      executionId: input.executionId,
      queueItemId: input.queueItemId,
      runnerId: input.runnerId,
      taskId: input.taskId,
      leaseToken: crypto.randomUUID(),
      status: 'active',
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
      lastRenewedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    return this.options.repository.saveExecutionLease(lease);
  }
}
```

- [ ] **Step 4: Add reconciler**

Create `src/main/services/runner-scheduler/LeaseReconciler.ts`:

```ts
import crypto from 'crypto';
import { RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';
import type { ExecutionLease, RunnerDispatchEvent, RunnerQueueItem } from '@shared/types';

interface RepositoryLike {
  listExpiredActiveLeases(nowIso: string): ExecutionLease[];
  listQueueItems(): RunnerQueueItem[];
  saveExecutionLease(lease: ExecutionLease): ExecutionLease;
  saveQueueItem(item: RunnerQueueItem): RunnerQueueItem;
  saveDispatchEvent(event: RunnerDispatchEvent): RunnerDispatchEvent;
}

export class LeaseReconciler {
  constructor(private readonly options: { repository: RepositoryLike; now?: () => Date; maxReassignAttempts?: number }) {}

  reconcile(): void {
    const now = this.options.now?.() ?? new Date();
    for (const lease of this.options.repository.listExpiredActiveLeases(now.toISOString())) {
      this.markLeaseOrphaned(lease, now);
      const item = this.options.repository.listQueueItems().find((queueItem) => queueItem.id === lease.queueItemId);
      if (!item) continue;
      if (item.idempotency === 'idempotent' && item.reassignAttempts < this.maxReassignAttempts()) {
        this.options.repository.saveQueueItem({
          ...item,
          status: 'queued',
          reassignAttempts: item.reassignAttempts + 1,
          lastError: 'Previous runner lease expired; requeued for reassignment',
          updatedAt: now.toISOString(),
        });
        this.event('reassign', lease, item, 'Idempotent orphaned execution requeued', now);
      } else {
        this.options.repository.saveQueueItem({
          ...item,
          status: 'terminal',
          lastError: 'Execution orphaned; automatic reassignment is not allowed for this task',
          updatedAt: now.toISOString(),
        });
        this.event('orphan', lease, item, 'Orphaned execution requires manual handling', now);
      }
    }
  }

  private markLeaseOrphaned(lease: ExecutionLease, now: Date): void {
    this.options.repository.saveExecutionLease({ ...lease, status: 'orphaned', updatedAt: now.toISOString() });
  }

  private event(eventType: RunnerDispatchEvent['eventType'], lease: ExecutionLease, item: RunnerQueueItem, message: string, now: Date): void {
    this.options.repository.saveDispatchEvent({
      id: crypto.randomUUID(),
      eventType,
      runnerId: lease.runnerId,
      queueItemId: item.id,
      executionId: lease.executionId,
      message,
      metadata: { idempotency: item.idempotency, reassignAttempts: item.reassignAttempts },
      createdAt: now.toISOString(),
    });
  }

  private maxReassignAttempts(): number {
    return this.options.maxReassignAttempts ?? RUNNER_SCHEDULER_DEFAULTS.maxReassignAttempts;
  }
}
```

Modify `src/main/services/runner-scheduler/index.ts`:

```ts
export { ExecutionLeaseService } from './ExecutionLeaseService';
export { LeaseReconciler } from './LeaseReconciler';
```

- [ ] **Step 5: Verify lease tests pass**

Run: `npx vitest run tests/unit/services/runner-scheduler/ExecutionLeaseService.test.ts tests/unit/services/runner-scheduler/LeaseReconciler.test.ts`

Expected: PASS.

---

### Task 7: Implement Runner Dispatch Service and Adapters

**Files:**
- Create: `src/main/services/runner-scheduler/RunnerAdapters.ts`
- Create: `src/main/services/runner-scheduler/RunnerDispatchService.ts`
- Modify: `src/main/services/runner-scheduler/index.ts`
- Test: `tests/unit/services/runner-scheduler/RunnerDispatchService.test.ts`

- [ ] **Step 1: Write failing dispatch test**

Create `tests/unit/services/runner-scheduler/RunnerDispatchService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { RunnerDispatchService } from '@main/services/runner-scheduler/RunnerDispatchService';
import type { RunnerNode, RunnerQueueItem } from '@shared/types';

const queueItem: RunnerQueueItem = {
  id: 'queue-1', taskId: 'task-1', taskType: 'collect', idempotency: 'idempotent', workspaceId: 'default',
  status: 'queued', priority: 0, reassignAttempts: 0, lastError: null,
  createdAt: '2026-04-21T00:00:00.000Z', updatedAt: '2026-04-21T00:00:00.000Z',
};
const runner = (id: string, runningCount: number): RunnerNode => ({
  id, kind: 'local', name: id, workspaceId: 'default', status: 'online', capabilities: ['browser-automation'],
  maxConcurrency: 4, runningCount, cpuUsage: 0.1, memoryUsage: 0.1, heartbeatLatencyMs: 10, recentFailureRate: 0,
  lastHeartbeatAt: '2026-04-21T00:00:00.000Z', lastSeenAt: '2026-04-21T00:00:00.000Z',
  createdAt: '2026-04-21T00:00:00.000Z', updatedAt: '2026-04-21T00:00:00.000Z',
});

describe('RunnerDispatchService', () => {
  it('dispatches queued work to lowest score runner and creates a lease', async () => {
    const queue = { peekNext: vi.fn(() => queueItem), markDispatching: vi.fn((item) => ({ ...item, status: 'dispatching' })), advanceCursor: vi.fn() };
    const registry = { listSchedulable: vi.fn(() => [runner('busy', 3), runner('idle', 0)]) };
    const leaseService = { createLease: vi.fn((input) => ({ id: 'lease-1', ...input })) };
    const adapter = { dispatch: vi.fn().mockResolvedValue({ executionId: 'exec-1' }) };
    const service = new RunnerDispatchService({ queue, registry, leaseService, adapters: { local: adapter, remote: adapter } });

    await service.tick();

    expect(adapter.dispatch).toHaveBeenCalledWith(expect.objectContaining({ runnerId: 'idle', queueItem }));
    expect(leaseService.createLease).toHaveBeenCalledWith(expect.objectContaining({ runnerId: 'idle', executionId: 'exec-1' }));
    expect(queue.advanceCursor).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing dispatch test**

Run: `npx vitest run tests/unit/services/runner-scheduler/RunnerDispatchService.test.ts`

Expected: FAIL with missing service.

- [ ] **Step 3: Add adapter interfaces**

Create `src/main/services/runner-scheduler/RunnerAdapters.ts`:

```ts
import type { RunnerNode, RunnerQueueItem } from '@shared/types';

export interface RunnerDispatchInput {
  runnerId: string;
  runner: RunnerNode;
  queueItem: RunnerQueueItem;
}

export interface RunnerDispatchResult {
  executionId: string;
}

export interface RunnerAdapter {
  dispatch(input: RunnerDispatchInput): Promise<RunnerDispatchResult>;
}

export class LocalRunnerAdapter implements RunnerAdapter {
  async dispatch(input: RunnerDispatchInput): Promise<RunnerDispatchResult> {
    return { executionId: `local-${input.queueItem.id}` };
  }
}
```

- [ ] **Step 4: Add dispatch service**

Create `src/main/services/runner-scheduler/RunnerDispatchService.ts`:

```ts
import { CapacityScoringService } from './CapacityScoringService';
import type { RunnerAdapter } from './RunnerAdapters';
import type { RunnerNode, RunnerQueueItem } from '@shared/types';

interface QueueLike {
  peekNext(): RunnerQueueItem | null;
  markDispatching(item: RunnerQueueItem): RunnerQueueItem;
  advanceCursor(): void;
}

interface RegistryLike {
  listSchedulable(workspaceId: string): RunnerNode[];
}

interface LeaseServiceLike {
  createLease(input: { executionId: string; queueItemId: string; runnerId: string; taskId: string }): unknown;
}

export class RunnerDispatchService {
  private readonly scorer = new CapacityScoringService();

  constructor(private readonly options: {
    queue: QueueLike;
    registry: RegistryLike;
    leaseService: LeaseServiceLike;
    adapters: Record<'local' | 'remote', RunnerAdapter>;
  }) {}

  async tick(): Promise<void> {
    const queueItem = this.options.queue.peekNext();
    if (!queueItem) return;
    const runners = this.options.registry.listSchedulable(queueItem.workspaceId);
    const { runner } = this.scorer.selectBest(runners);
    if (!runner) {
      this.options.queue.advanceCursor();
      return;
    }
    const dispatching = this.options.queue.markDispatching(queueItem);
    const result = await this.options.adapters[runner.kind].dispatch({ runnerId: runner.id, runner, queueItem: dispatching });
    this.options.leaseService.createLease({
      executionId: result.executionId,
      queueItemId: queueItem.id,
      runnerId: runner.id,
      taskId: queueItem.taskId,
    });
    this.options.queue.advanceCursor();
  }
}
```

Modify `src/main/services/runner-scheduler/index.ts`:

```ts
export { RunnerDispatchService } from './RunnerDispatchService';
export type { RunnerAdapter, RunnerDispatchInput, RunnerDispatchResult } from './RunnerAdapters';
export { LocalRunnerAdapter } from './RunnerAdapters';
```

- [ ] **Step 5: Verify dispatch test passes**

Run: `npx vitest run tests/unit/services/runner-scheduler/RunnerDispatchService.test.ts`

Expected: PASS.

---

### Task 8: Register Scheduler IPC Handlers

**Files:**
- Create: `src/main/ipc/runner-scheduler-handlers.ts`
- Modify: `src/main/app.ts`
- Test: `tests/unit/ipc/runner-scheduler-handlers.spec.ts`
- Test: `tests/unit/services/AppComposition.test.ts`

- [ ] **Step 1: Write failing IPC test**

Create `tests/unit/ipc/runner-scheduler-handlers.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerRunnerSchedulerHandlers } from '@main/ipc/runner-scheduler-handlers';

describe('registerRunnerSchedulerHandlers', () => {
  it('registers registry queue dispatch and lease channels', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = { handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => handlers.set(channel, handler)) };
    const service = {
      listRunners: vi.fn(() => []), heartbeat: vi.fn(), drain: vi.fn(), resume: vi.fn(),
      listQueue: vi.fn(() => []), enqueue: vi.fn(), cancelQueueItem: vi.fn(), dispatchTick: vi.fn(),
      listLeases: vi.fn(() => []), renewLease: vi.fn(), releaseLease: vi.fn(), reconcile: vi.fn(),
    };

    registerRunnerSchedulerHandlers({ ipcController, service });

    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.RUNNER_REGISTRY_LIST, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.RUNNER_LEASE_RECONCILE, expect.any(Function));
    await handlers.get(IPC_CHANNELS.RUNNER_REGISTRY_LIST)?.({});
    expect(service.listRunners).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing IPC test**

Run: `npx vitest run tests/unit/ipc/runner-scheduler-handlers.spec.ts`

Expected: FAIL with missing handler module.

- [ ] **Step 3: Add IPC handlers**

Create `src/main/ipc/runner-scheduler-handlers.ts`:

```ts
import { IPC_CHANNELS } from '@shared/constants';

interface IpcControllerLike {
  handle(channel: string, handler: (payload: any) => unknown): void;
}

interface RunnerSchedulerFacade {
  listRunners(): unknown;
  heartbeat(payload: unknown): unknown;
  drain(payload: unknown): unknown;
  resume(payload: unknown): unknown;
  listQueue(): unknown;
  enqueue(payload: unknown): unknown;
  cancelQueueItem(payload: unknown): unknown;
  dispatchTick(): unknown;
  listLeases(): unknown;
  renewLease(payload: unknown): unknown;
  releaseLease(payload: unknown): unknown;
  reconcile(): unknown;
}

export function registerRunnerSchedulerHandlers(options: { ipcController: IpcControllerLike; service: RunnerSchedulerFacade }): void {
  const { ipcController, service } = options;
  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_LIST, () => service.listRunners());
  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_HEARTBEAT, (payload) => service.heartbeat(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_DRAIN, (payload) => service.drain(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_RESUME, (payload) => service.resume(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_QUEUE_LIST, () => service.listQueue());
  ipcController.handle(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE, (payload) => service.enqueue(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_QUEUE_CANCEL, (payload) => service.cancelQueueItem(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_DISPATCH_TICK, () => service.dispatchTick());
  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_LIST, () => service.listLeases());
  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_RENEW, (payload) => service.renewLease(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_RELEASE, (payload) => service.releaseLease(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_RECONCILE, () => service.reconcile());
}
```

- [ ] **Step 4: Wire app composition**

Modify `src/main/app.ts` to instantiate repository and scheduler services after database setup. Keep composition additive and register handlers with existing `IpcController`.

Use this shape at the composition boundary:

```ts
const runnerSchedulerRepository = new RunnerSchedulerRepository(databaseService.database);
const runnerRegistry = new RunnerRegistryService({ repository: runnerSchedulerRepository });
const dispatchQueue = new DispatchQueueService({ repository: runnerSchedulerRepository });
const leaseService = new ExecutionLeaseService({ repository: runnerSchedulerRepository });
const leaseReconciler = new LeaseReconciler({ repository: runnerSchedulerRepository });
const runnerDispatch = new RunnerDispatchService({
  queue: dispatchQueue,
  registry: runnerRegistry,
  leaseService,
  adapters: {
    local: new LocalRunnerAdapter(),
    remote: new RemoteRunnerAdapter(remoteRunnerService),
  },
});
```

If `RemoteRunnerAdapter` is not implemented yet, create a minimal adapter in Task 7 that wraps `RemoteRunnerService.startExecution` and returns `{ executionId }`.

- [ ] **Step 5: Verify IPC and composition tests pass**

Run: `npx vitest run tests/unit/ipc/runner-scheduler-handlers.spec.ts tests/unit/services/AppComposition.test.ts`

Expected: PASS.

---

### Task 9: Add Renderer API and Runner Scheduler Panel

**Files:**
- Create: `src/renderer/shared/api/runnerScheduler.ts`
- Create: `src/renderer/entries/automation/components/RunnerSchedulerPanel.tsx`
- Modify: `src/renderer/entries/automation/App.tsx`
- Test: `tests/unit/renderer/api/runnerScheduler.spec.ts`
- Test: `tests/unit/components/RunnerSchedulerPanel.test.tsx`
- Test: `tests/unit/components/AutomationApp.test.tsx`

- [ ] **Step 1: Write failing renderer API test**

Create `tests/unit/renderer/api/runnerScheduler.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { createRunnerSchedulerApi } from '@renderer/shared/api/runnerScheduler';

describe('createRunnerSchedulerApi', () => {
  it('invokes registry list channel', async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    const api = createRunnerSchedulerApi({ invoke });
    await expect(api.listRunners()).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.RUNNER_REGISTRY_LIST);
  });
});
```

- [ ] **Step 2: Write failing panel test**

Create `tests/unit/components/RunnerSchedulerPanel.test.tsx` with existing Ant Design mock patterns from `RemoteRunnerPanel.test.tsx`. Minimum assertion:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@renderer/shared/hooks', () => ({ useIpc: () => ({ invoke: invokeMock }) }));
vi.mock('antd', () => ({
  Card: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => <section><h2>{title}</h2>{children}</section>,
  List: ({ dataSource, renderItem }: { dataSource?: unknown[]; renderItem: (item: unknown) => React.ReactNode }) => <div>{(dataSource ?? []).map((item, index) => <div key={index}>{renderItem(item)}</div>)}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { RunnerSchedulerPanel } from '@renderer/entries/automation/components/RunnerSchedulerPanel';

describe('RunnerSchedulerPanel', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        return [{ id: 'runner-local', name: 'Local Runner', kind: 'local', status: 'online', runningCount: 1, maxConcurrency: 4, recentFailureRate: 0 }];
      }
      if (channel === 'runner:queue:list' || channel === 'runner:lease:list') return [];
      return null;
    });
  });

  it('renders runner pool status', async () => {
    render(<RunnerSchedulerPanel />);
    expect(await screen.findByText('Local Runner')).toBeDefined();
    expect(await screen.findByText('online')).toBeDefined();
  });
});
```

- [ ] **Step 3: Run failing renderer tests**

Run: `npx vitest run tests/unit/renderer/api/runnerScheduler.spec.ts tests/unit/components/RunnerSchedulerPanel.test.tsx`

Expected: FAIL with missing API and component.

- [ ] **Step 4: Add renderer API**

Create `src/renderer/shared/api/runnerScheduler.ts`:

```ts
import { IPC_CHANNELS } from '@shared/constants';

export function createRunnerSchedulerApi(options: { invoke: (channel: string, payload?: unknown) => Promise<unknown> }) {
  return {
    listRunners: () => options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_LIST),
    heartbeat: (payload: unknown) => options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_HEARTBEAT, payload),
    drain: (runnerId: string) => options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_DRAIN, { runnerId }),
    resume: (runnerId: string) => options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_RESUME, { runnerId }),
    listQueue: () => options.invoke(IPC_CHANNELS.RUNNER_QUEUE_LIST),
    enqueue: (payload: unknown) => options.invoke(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE, payload),
    cancelQueueItem: (queueItemId: string) => options.invoke(IPC_CHANNELS.RUNNER_QUEUE_CANCEL, { queueItemId }),
    dispatchTick: () => options.invoke(IPC_CHANNELS.RUNNER_DISPATCH_TICK),
    listLeases: () => options.invoke(IPC_CHANNELS.RUNNER_LEASE_LIST),
    reconcile: () => options.invoke(IPC_CHANNELS.RUNNER_LEASE_RECONCILE),
  };
}
```

- [ ] **Step 5: Add panel component**

Create `src/renderer/entries/automation/components/RunnerSchedulerPanel.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, List, Space, Tag } from 'antd';
import type { ExecutionLease, RunnerNode, RunnerQueueItem } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';
import { createRunnerSchedulerApi } from '@renderer/shared/api/runnerScheduler';

export function RunnerSchedulerPanel() {
  const { invoke } = useIpc();
  const api = useMemo(() => createRunnerSchedulerApi({ invoke }), [invoke]);
  const [runners, setRunners] = useState<RunnerNode[]>([]);
  const [queue, setQueue] = useState<RunnerQueueItem[]>([]);
  const [leases, setLeases] = useState<ExecutionLease[]>([]);

  const refresh = useCallback(async () => {
    const [nextRunners, nextQueue, nextLeases] = await Promise.all([
      api.listRunners() as Promise<RunnerNode[]>,
      api.listQueue() as Promise<RunnerQueueItem[]>,
      api.listLeases() as Promise<ExecutionLease[]>,
    ]);
    setRunners(nextRunners);
    setQueue(nextQueue);
    setLeases(nextLeases);
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Card title="Runner 调度池">
      <Space>
        <Button onClick={() => void refresh()}>刷新</Button>
        <Button onClick={() => void api.dispatchTick().then(refresh)}>调度一次</Button>
        <Button onClick={() => void api.reconcile().then(refresh)}>恢复检查</Button>
      </Space>
      <h3>Runner</h3>
      <List
        dataSource={runners}
        renderItem={(runner) => (
          <div>
            <strong>{runner.name}</strong> <Tag>{runner.kind}</Tag> <Tag>{runner.status}</Tag>
            <span>{runner.runningCount}/{runner.maxConcurrency}</span>
            <span>失败率 {Math.round(runner.recentFailureRate * 100)}%</span>
          </div>
        )}
      />
      <h3>队列</h3>
      <div>collect: {queue.filter((item) => item.taskType === 'collect').length}</div>
      <div>inspect: {queue.filter((item) => item.taskType === 'inspect').length}</div>
      <div>replay: {queue.filter((item) => item.taskType === 'replay').length}</div>
      <h3>Lease</h3>
      <div>{leases.length} active / orphaned leases</div>
    </Card>
  );
}
```

Modify `src/renderer/entries/automation/App.tsx` to render `<RunnerSchedulerPanel />` near the existing Remote Runner panel.

- [ ] **Step 6: Verify renderer tests pass**

Run: `npx vitest run tests/unit/renderer/api/runnerScheduler.spec.ts tests/unit/components/RunnerSchedulerPanel.test.tsx tests/unit/components/AutomationApp.test.tsx`

Expected: PASS.

---

### Task 10: Add Remote Runner Heartbeat Metrics

**Files:**
- Modify: `src/runner/daemon/InMemoryRemoteRunnerRuntime.ts`
- Modify: `src/runner/daemon/RemoteRunnerServer.ts`
- Test: `tests/unit/runner/remote-runner-server.spec.ts`

- [ ] **Step 1: Add failing daemon metrics test**

Modify `tests/unit/runner/remote-runner-server.spec.ts` with a test:

```ts
it('returns runner scheduler metrics in health response', async () => {
  const server = await createRemoteRunnerServer({ token: 'dev-token', workspaceId: 'default', port: 0 });
  try {
    const response = await fetch(`${server.url}/v1/runner/health`, {
      headers: { Authorization: 'Bearer dev-token', 'X-YClaw-Workspace': 'default', 'X-YClaw-Actor': 'test' },
    });
    const body = await response.json();
    expect(body.metrics).toMatchObject({
      maxConcurrency: expect.any(Number),
      runningCount: expect.any(Number),
      cpuUsage: expect.any(Number),
      memoryUsage: expect.any(Number),
      recentFailureRate: expect.any(Number),
    });
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Run failing daemon test**

Run: `npx vitest run tests/unit/runner/remote-runner-server.spec.ts`

Expected: FAIL because `metrics` is missing.

- [ ] **Step 3: Add runtime metrics**

Modify `src/runner/daemon/InMemoryRemoteRunnerRuntime.ts`:

```ts
getMetrics() {
  return {
    maxConcurrency: 2,
    runningCount: this.listExecutions().filter((execution) => execution.status === 'running' || execution.status === 'queued').length,
    cpuUsage: 0,
    memoryUsage: 0,
    heartbeatLatencyMs: 0,
    recentFailureRate: this.calculateRecentFailureRate(),
  };
}

private calculateRecentFailureRate(): number {
  const executions = this.listExecutions().slice(-20);
  if (executions.length === 0) return 0;
  const failed = executions.filter((execution) => execution.status === 'failed' || execution.status === 'timeout').length;
  return failed / executions.length;
}
```

If `listExecutions()` does not exist, add it as a read-only method returning the runtime execution array.

- [ ] **Step 4: Include metrics in health route**

Modify `src/runner/daemon/RemoteRunnerServer.ts` health response:

```ts
writeJson(response, 200, {
  status: 'ok',
  queuedCount: runtime.getQueuedCount(),
  runningCount: runtime.getRunningCount(),
  lastError: null,
  checkedAt: new Date().toISOString(),
  metrics: runtime.getMetrics(),
});
```

- [ ] **Step 5: Verify daemon test passes**

Run: `npx vitest run tests/unit/runner/remote-runner-server.spec.ts`

Expected: PASS.

---

### Task 11: Full Verification and Documentation Check

**Files:**
- Modify if needed: `docs/README.md`
- Verify: entire repository

- [ ] **Step 1: Verify scheduler focused suite**

Run:

```bash
npx vitest run \
  tests/unit/shared/runner-scheduler.spec.ts \
  tests/unit/services/repositories/RunnerSchedulerRepository.test.ts \
  tests/unit/services/runner-scheduler/CapacityScoringService.test.ts \
  tests/unit/services/runner-scheduler/RunnerRegistryService.test.ts \
  tests/unit/services/runner-scheduler/DispatchQueueService.test.ts \
  tests/unit/services/runner-scheduler/ExecutionLeaseService.test.ts \
  tests/unit/services/runner-scheduler/LeaseReconciler.test.ts \
  tests/unit/services/runner-scheduler/RunnerDispatchService.test.ts \
  tests/unit/ipc/runner-scheduler-handlers.spec.ts \
  tests/unit/renderer/api/runnerScheduler.spec.ts \
  tests/unit/components/RunnerSchedulerPanel.test.tsx \
  tests/unit/runner/remote-runner-server.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS with zero failing tests.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: exit code 0. Existing unrelated warnings may remain, but no new errors should be introduced.

- [ ] **Step 5: Check docs are indexed**

Run: `rg "capacity-aware-runner-scheduler-v1" docs/README.md docs/specs docs/superpowers/plans`

Expected: README, spec, and plan paths are all discoverable.

---

## Self-Review Checklist

- [ ] Every P0 requirement in the spec maps to at least one task above.
- [ ] Scheduler behavior is additive and does not remove existing local / remote execution paths.
- [ ] `unknown` idempotency never auto-reassigns.
- [ ] Scoring uses the exact weights from the spec.
- [ ] Queue weights default to `inspect:collect:replay = 4:3:1`.
- [ ] Tests include red/green instructions for each production change.
- [ ] Full verification commands are listed with expected outcomes.

