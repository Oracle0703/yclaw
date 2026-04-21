import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { RunnerSchedulerRepository } from '@main/services/repositories/RunnerSchedulerRepository';
import { DatabaseService } from '@main/services/DatabaseService';

describe('RunnerSchedulerRepository', () => {
  function createRepository() {
    const db = new Database(':memory:');
    new DatabaseService({ database: db }).migrate();
    return {
      db,
      repository: new RunnerSchedulerRepository(db),
    };
  }

  it('saves and lists runner nodes', () => {
    const { repository } = createRepository();
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
    const { repository } = createRepository();
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

  it('saves and lists queue items', () => {
    const { repository } = createRepository();
    repository.saveQueueItem({
      id: 'queue-1',
      taskId: 'task-1',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'default',
      status: 'queued',
      priority: 10,
      reassignAttempts: 0,
      lastError: null,
      remoteDispatch: {
        runnerConnectionId: 'conn-1',
        revisionId: 'rev-1',
        sessionId: 'session-1',
      },
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(repository.listQueueItems()).toEqual([
      {
        id: 'queue-1',
        taskId: 'task-1',
        taskType: 'collect',
        idempotency: 'idempotent',
        workspaceId: 'default',
        status: 'queued',
        priority: 10,
        reassignAttempts: 0,
        lastError: null,
        remoteDispatch: {
          runnerConnectionId: 'conn-1',
          revisionId: 'rev-1',
          sessionId: 'session-1',
        },
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);
  });

  it('hydrates wrong-shaped remote dispatch json as undefined', () => {
    const { db, repository } = createRepository();
    db.prepare(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'queue-bad-remote',
      'task-1',
      'collect',
      'idempotent',
      'default',
      'queued',
      0,
      0,
      null,
      '{"runnerConnectionId":"conn-only"}',
      '2026-04-21T00:00:00.000Z',
      '2026-04-21T00:00:00.000Z',
    );

    expect(repository.listQueueItems()).toEqual([
      expect.objectContaining({
        id: 'queue-bad-remote',
        remoteDispatch: undefined,
      }),
    ]);
  });

  it('adds remote_dispatch_json column when upgrading from v6', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO migrations (version) VALUES (6);
      CREATE TABLE runner_queue_items (
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
    `);

    new DatabaseService({ database: db }).migrate();
    const columns = db.prepare(`PRAGMA table_info(runner_queue_items)`).all() as Array<{
      name: string;
    }>;

    expect(columns.map((column) => column.name)).toContain('remote_dispatch_json');
  });

  it('saves health samples to storage', () => {
    const { db, repository } = createRepository();
    repository.saveHealthSample({
      id: 'sample-1',
      runnerId: 'runner-local',
      cpuUsage: 0.2,
      memoryUsage: 0.4,
      runningCount: 1,
      maxConcurrency: 2,
      heartbeatLatencyMs: 18,
      recentFailureRate: 0.1,
      sampledAt: '2026-04-21T00:00:00.000Z',
    });

    const row = db.prepare(
      `SELECT id, runner_id, cpu_usage, memory_usage, sampled_at
       FROM runner_health_samples
       WHERE id = ?`,
    ).get('sample-1') as Record<string, unknown> | undefined;

    expect(row).toEqual({
      id: 'sample-1',
      runner_id: 'runner-local',
      cpu_usage: 0.2,
      memory_usage: 0.4,
      sampled_at: '2026-04-21T00:00:00.000Z',
    });
  });

  it('saves dispatch events and writes metadata json', () => {
    const { db, repository } = createRepository();
    repository.saveDispatchEvent({
      id: 'event-1',
      eventType: 'dispatch',
      runnerId: 'runner-local',
      queueItemId: 'queue-1',
      executionId: 'exec-1',
      message: 'dispatch ok',
      metadata: {
        reason: 'test',
        attempt: 1,
      },
      createdAt: '2026-04-21T00:00:00.000Z',
    });

    const row = db.prepare(
      `SELECT id, event_type, metadata_json
       FROM runner_dispatch_events
       WHERE id = ?`,
    ).get('event-1') as Record<string, unknown> | undefined;

    expect(row).toEqual({
      id: 'event-1',
      event_type: 'dispatch',
      metadata_json: '{"reason":"test","attempt":1}',
    });
  });

  it('hydrates wrong-shaped capabilities json as empty array', () => {
    const { db, repository } = createRepository();
    db.prepare(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'runner-bad-capabilities',
      'local',
      'Bad Capabilities',
      'default',
      'online',
      '{"bad":"shape"}',
      1,
      0,
      0.1,
      0.2,
      10,
      0,
      '2026-04-21T00:00:00.000Z',
      '2026-04-21T00:00:00.000Z',
      '2026-04-21T00:00:00.000Z',
      '2026-04-21T00:00:00.000Z',
    );

    expect(repository.listRunnerNodes()).toEqual([
      expect.objectContaining({
        id: 'runner-bad-capabilities',
        capabilities: [],
      }),
    ]);
  });

  it('rolls back sqlite writes when transaction work throws', () => {
    const { repository } = createRepository();

    expect(() =>
      repository.transaction(() => {
        repository.saveQueueItem({
          id: 'queue-rollback',
          taskId: 'task-rollback',
          taskType: 'collect',
          idempotency: 'idempotent',
          workspaceId: 'default',
          status: 'queued',
          priority: 0,
          reassignAttempts: 0,
          lastError: null,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        });
        throw new Error('rollback');
      }),
    ).toThrow('rollback');

    expect(repository.listQueueItems()).toHaveLength(0);
  });

  it('falls back to direct execution when transaction is unavailable on executor', () => {
    const repository = new RunnerSchedulerRepository({
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0 }),
    });

    const result = repository.transaction(() => 'ok');

    expect(result).toBe('ok');
  });
});
