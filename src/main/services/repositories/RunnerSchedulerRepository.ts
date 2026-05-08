import Database from 'better-sqlite3';
import type {
  ExecutionLease,
  RunnerDispatchEvent,
  RunnerHealthSample,
  RunnerNode,
  RunnerQueueItem,
  RunnerRemoteDispatch,
} from '@shared/types';

interface RunnerSchedulerRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface RunnerNodeRow {
  id: string;
  kind: RunnerNode['kind'];
  name: string;
  workspace_id: string;
  status: RunnerNode['status'];
  capabilities_json: string;
  max_concurrency: number;
  running_count: number;
  cpu_usage: number;
  memory_usage: number;
  heartbeat_latency_ms: number;
  recent_failure_rate: number;
  last_heartbeat_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RunnerQueueItemRow {
  id: string;
  task_id: string;
  task_type: RunnerQueueItem['taskType'];
  idempotency: RunnerQueueItem['idempotency'];
  workspace_id: string;
  status: RunnerQueueItem['status'];
  priority: number;
  reassign_attempts: number;
  last_error: string | null;
  remote_dispatch_json: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionLeaseRow {
  id: string;
  execution_id: string;
  queue_item_id: string;
  runner_id: string;
  task_id: string;
  lease_token: string;
  status: ExecutionLease['status'];
  expires_at: string;
  last_renewed_at: string;
  created_at: string;
  updated_at: string;
}

type RunnerSchedulerExecutorInput = RunnerSchedulerRepositoryExecutor | Database.Database;

export class RunnerSchedulerRepository {
  private readonly executor: RunnerSchedulerRepositoryExecutor;
  private readonly database: Database.Database | null;

  constructor(executor: RunnerSchedulerExecutorInput) {
    this.database = isExecutor(executor) ? null : executor;
    this.executor = toExecutor(executor);
  }

  transaction<T>(work: () => T): T {
    if (!this.database) {
      return work();
    }
    return this.database.transaction(work)();
  }

  saveRunnerNode(node: RunnerNode): RunnerNode {
    this.executor.run(
      `INSERT INTO runner_nodes (
        id,
        kind,
        name,
        workspace_id,
        status,
        capabilities_json,
        max_concurrency,
        running_count,
        cpu_usage,
        memory_usage,
        heartbeat_latency_ms,
        recent_failure_rate,
        last_heartbeat_at,
        last_seen_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        updated_at = excluded.updated_at`,
      [
        node.id,
        node.kind,
        node.name,
        node.workspaceId,
        node.status,
        JSON.stringify(node.capabilities),
        node.maxConcurrency,
        node.runningCount,
        node.cpuUsage,
        node.memoryUsage,
        node.heartbeatLatencyMs,
        node.recentFailureRate,
        node.lastHeartbeatAt,
        node.lastSeenAt,
        node.createdAt,
        node.updatedAt,
      ],
    );

    return node;
  }

  listRunnerNodes(): RunnerNode[] {
    return this.executor
      .all<RunnerNodeRow>(
        `SELECT
          id,
          kind,
          name,
          workspace_id,
          status,
          capabilities_json,
          max_concurrency,
          running_count,
          cpu_usage,
          memory_usage,
          heartbeat_latency_ms,
          recent_failure_rate,
          last_heartbeat_at,
          last_seen_at,
          created_at,
          updated_at
        FROM runner_nodes
        ORDER BY updated_at DESC`,
      )
      .map((row) => ({
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
    this.executor.run(
      `INSERT INTO runner_queue_items (
        id,
        task_id,
        task_type,
        idempotency,
        workspace_id,
        status,
        priority,
        reassign_attempts,
        last_error,
        remote_dispatch_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        task_type = excluded.task_type,
        idempotency = excluded.idempotency,
        workspace_id = excluded.workspace_id,
        status = excluded.status,
        priority = excluded.priority,
        reassign_attempts = excluded.reassign_attempts,
        last_error = excluded.last_error,
        remote_dispatch_json = excluded.remote_dispatch_json,
        updated_at = excluded.updated_at`,
      [
        item.id,
        item.taskId,
        item.taskType,
        item.idempotency,
        item.workspaceId,
        item.status,
        item.priority,
        item.reassignAttempts,
        item.lastError,
        item.remoteDispatch ? JSON.stringify(item.remoteDispatch) : null,
        item.createdAt,
        item.updatedAt,
      ],
    );

    return item;
  }

  listQueueItems(): RunnerQueueItem[] {
    return this.executor
      .all<RunnerQueueItemRow>(
        `SELECT
          id,
          task_id,
          task_type,
          idempotency,
          workspace_id,
          status,
          priority,
          reassign_attempts,
          last_error,
          remote_dispatch_json,
          created_at,
          updated_at
        FROM runner_queue_items
        ORDER BY created_at ASC`,
      )
      .map((row) => ({
        id: row.id,
        taskId: row.task_id,
        taskType: row.task_type,
        idempotency: row.idempotency,
        workspaceId: row.workspace_id,
        status: row.status,
        priority: row.priority,
        reassignAttempts: row.reassign_attempts,
        lastError: row.last_error,
        remoteDispatch: parseRemoteDispatch(row.remote_dispatch_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  saveExecutionLease(lease: ExecutionLease): ExecutionLease {
    this.executor.run(
      `INSERT INTO execution_leases (
        id,
        execution_id,
        queue_item_id,
        runner_id,
        task_id,
        lease_token,
        status,
        expires_at,
        last_renewed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        execution_id = excluded.execution_id,
        queue_item_id = excluded.queue_item_id,
        runner_id = excluded.runner_id,
        task_id = excluded.task_id,
        lease_token = excluded.lease_token,
        status = excluded.status,
        expires_at = excluded.expires_at,
        last_renewed_at = excluded.last_renewed_at,
        updated_at = excluded.updated_at`,
      [
        lease.id,
        lease.executionId,
        lease.queueItemId,
        lease.runnerId,
        lease.taskId,
        lease.leaseToken,
        lease.status,
        lease.expiresAt,
        lease.lastRenewedAt,
        lease.createdAt,
        lease.updatedAt,
      ],
    );

    return lease;
  }

  listExpiredActiveLeases(nowIso: string): ExecutionLease[] {
    return this.executor
      .all<ExecutionLeaseRow>(
        `SELECT
          id,
          execution_id,
          queue_item_id,
          runner_id,
          task_id,
          lease_token,
          status,
          expires_at,
          last_renewed_at,
          created_at,
          updated_at
        FROM execution_leases
        WHERE status = 'active'
          AND expires_at < ?
        ORDER BY expires_at ASC`,
        [nowIso],
      )
      .map((row) => ({
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
    this.executor.run(
      `INSERT INTO runner_health_samples (
        id,
        runner_id,
        cpu_usage,
        memory_usage,
        running_count,
        max_concurrency,
        heartbeat_latency_ms,
        recent_failure_rate,
        sampled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        runner_id = excluded.runner_id,
        cpu_usage = excluded.cpu_usage,
        memory_usage = excluded.memory_usage,
        running_count = excluded.running_count,
        max_concurrency = excluded.max_concurrency,
        heartbeat_latency_ms = excluded.heartbeat_latency_ms,
        recent_failure_rate = excluded.recent_failure_rate,
        sampled_at = excluded.sampled_at`,
      [
        sample.id,
        sample.runnerId,
        sample.cpuUsage,
        sample.memoryUsage,
        sample.runningCount,
        sample.maxConcurrency,
        sample.heartbeatLatencyMs,
        sample.recentFailureRate,
        sample.sampledAt,
      ],
    );

    return sample;
  }

  saveDispatchEvent(event: RunnerDispatchEvent): RunnerDispatchEvent {
    this.executor.run(
      `INSERT INTO runner_dispatch_events (
        id,
        event_type,
        runner_id,
        queue_item_id,
        execution_id,
        message,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        event_type = excluded.event_type,
        runner_id = excluded.runner_id,
        queue_item_id = excluded.queue_item_id,
        execution_id = excluded.execution_id,
        message = excluded.message,
        metadata_json = excluded.metadata_json,
        created_at = excluded.created_at`,
      [
        event.id,
        event.eventType,
        event.runnerId,
        event.queueItemId,
        event.executionId,
        event.message,
        JSON.stringify(event.metadata),
        event.createdAt,
      ],
    );

    return event;
  }
}

function isExecutor(
  input: RunnerSchedulerExecutorInput,
): input is RunnerSchedulerRepositoryExecutor {
  return typeof (input as RunnerSchedulerRepositoryExecutor).all === 'function'
    && typeof (input as RunnerSchedulerRepositoryExecutor).get === 'function'
    && typeof (input as RunnerSchedulerRepositoryExecutor).run === 'function';
}

function toExecutor(input: RunnerSchedulerExecutorInput): RunnerSchedulerRepositoryExecutor {
  if (isExecutor(input)) {
    return input;
  }

  return {
    all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      const statement = input.prepare(sql);
      return (params ? statement.all(...params) : statement.all()) as T[];
    },
    get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
      const statement = input.prepare(sql);
      return (params ? statement.get(...params) : statement.get()) as T | undefined;
    },
    run(sql: string, params?: unknown[]): { changes?: number } {
      const statement = input.prepare(sql);
      return params ? statement.run(...params) : statement.run();
    },
  };
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    if (!parsed.every((entry) => typeof entry === 'string')) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function parseRemoteDispatch(value: string | null): RunnerRemoteDispatch | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }

    const candidate = parsed as {
      runnerConnectionId?: unknown;
      revisionId?: unknown;
      sessionId?: unknown;
      timeoutMs?: unknown;
      retry?: unknown;
    };
    if (
      typeof candidate.runnerConnectionId !== 'string'
      || candidate.runnerConnectionId.length === 0
      || typeof candidate.revisionId !== 'string'
      || candidate.revisionId.length === 0
    ) {
      return undefined;
    }

    const remoteDispatch: RunnerRemoteDispatch = {
      runnerConnectionId: candidate.runnerConnectionId,
      revisionId: candidate.revisionId,
    };

    if (typeof candidate.sessionId === 'string' || candidate.sessionId === null) {
      remoteDispatch.sessionId = candidate.sessionId;
    }

    if (typeof candidate.timeoutMs === 'number' && Number.isFinite(candidate.timeoutMs)) {
      remoteDispatch.timeoutMs = candidate.timeoutMs;
    }

    if (typeof candidate.retry === 'object' && candidate.retry !== null) {
      const retry = candidate.retry as { maxAttempts?: unknown; backoff?: unknown };
      if (
        typeof retry.maxAttempts === 'number'
        && Number.isFinite(retry.maxAttempts)
        && (retry.backoff === 'fixed' || retry.backoff === 'exponential')
      ) {
        remoteDispatch.retry = {
          maxAttempts: retry.maxAttempts,
          backoff: retry.backoff,
        };
      }
    }

    return remoteDispatch;
  } catch {
    return undefined;
  }
}
