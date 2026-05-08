import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type { RunnerDispatchInput } from '@main/services/runner-scheduler';
import { DispatchQueueService } from '@main/services/runner-scheduler';
import { RemoteRunnerAdapter } from '@main/services/runner-scheduler';
import { DatabaseService } from '@main/services/DatabaseService';
import { RunnerSchedulerRepository } from '@main/services/repositories/RunnerSchedulerRepository';

function createRemoteInput(overrides: Partial<RunnerDispatchInput> = {}): RunnerDispatchInput {
  return {
    runnerId: 'runner-remote-1',
    runner: {
      id: 'runner-remote-1',
      kind: 'remote',
      name: 'Remote Runner',
      workspaceId: 'ws-1',
      status: 'online',
      capabilities: ['browser-automation'],
      maxConcurrency: 2,
      runningCount: 0,
      cpuUsage: 0.1,
      memoryUsage: 0.1,
      heartbeatLatencyMs: 5,
      recentFailureRate: 0,
      lastHeartbeatAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    queueItem: {
      id: 'queue-1',
      taskId: 'task-1',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'ws-1',
      status: 'queued',
      priority: 0,
      reassignAttempts: 0,
      lastError: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      remoteDispatch: {
        runnerConnectionId: 'conn-1',
        revisionId: 'rev-1',
      },
    } as RunnerDispatchInput['queueItem'],
    ...overrides,
  };
}

describe('RemoteRunnerAdapter', () => {
  it('uses explicit remote dispatch metadata and returns execution id from response.id', async () => {
    const startExecution = vi.fn(async () => ({ id: 'remote-exec-1' }));
    const adapter = new RemoteRunnerAdapter({ startExecution });

    const result = await adapter.dispatch(createRemoteInput());

    expect(startExecution).toHaveBeenCalledWith({
      runnerConnectionId: 'conn-1',
      taskId: 'task-1',
      revisionId: 'rev-1',
      sessionId: undefined,
      timeoutMs: undefined,
      retry: undefined,
    });
    expect(result).toEqual({ executionId: 'remote-exec-1' });
  });

  it('fails fast when remote dispatch metadata is missing', async () => {
    const startExecution = vi.fn();
    const adapter = new RemoteRunnerAdapter({ startExecution });

    const input = createRemoteInput({
      queueItem: {
        ...createRemoteInput().queueItem,
        remoteDispatch: undefined,
      } as RunnerDispatchInput['queueItem'],
    });

    await expect(adapter.dispatch(input)).rejects.toThrow('remoteDispatch is required for remote runner dispatch');
    expect(startExecution).not.toHaveBeenCalled();
  });

  it('fails fast when remote dispatch fields are missing', async () => {
    const startExecution = vi.fn();
    const adapter = new RemoteRunnerAdapter({ startExecution });

    const input = createRemoteInput({
      queueItem: {
        ...createRemoteInput().queueItem,
        remoteDispatch: {
          runnerConnectionId: '',
          revisionId: '',
        },
      } as RunnerDispatchInput['queueItem'],
    });

    await expect(adapter.dispatch(input)).rejects.toThrow(
      'remoteDispatch.runnerConnectionId and remoteDispatch.revisionId are required',
    );
    expect(startExecution).not.toHaveBeenCalled();
  });

  it('fails fast when remote execution response misses id', async () => {
    const startExecution = vi.fn(async () => ({ executionId: 'legacy-shape' }));
    const adapter = new RemoteRunnerAdapter({ startExecution });

    await expect(adapter.dispatch(createRemoteInput())).rejects.toThrow('Remote execution id is required');
  });

  it('keeps remoteDispatch through enqueue -> persistence -> readback -> remote dispatch', async () => {
    const db = new Database(':memory:');
    new DatabaseService({ database: db }).migrate();
    const repository = new RunnerSchedulerRepository(db);
    const queue = new DispatchQueueService({
      repository,
      now: () => new Date('2026-04-21T00:00:00.000Z'),
    });
    const queued = queue.enqueue({
      taskId: 'task-remote-1',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'ws-1',
      remoteDispatch: {
        runnerConnectionId: 'conn-remote-1',
        revisionId: 'rev-remote-1',
        sessionId: 'session-remote-1',
      },
    });
    const readback = repository.listQueueItems().find((item) => item.id === queued.id);
    expect(readback?.remoteDispatch).toEqual({
      runnerConnectionId: 'conn-remote-1',
      revisionId: 'rev-remote-1',
      sessionId: 'session-remote-1',
    });

    const startExecution = vi.fn(async () => ({ id: 'remote-exec-chain-1' }));
    const adapter = new RemoteRunnerAdapter({ startExecution });
    const result = await adapter.dispatch({
      ...createRemoteInput(),
      queueItem: readback as RunnerDispatchInput['queueItem'],
    });

    expect(startExecution).toHaveBeenCalledWith({
      runnerConnectionId: 'conn-remote-1',
      taskId: 'task-remote-1',
      revisionId: 'rev-remote-1',
      sessionId: 'session-remote-1',
      timeoutMs: undefined,
      retry: undefined,
    });
    expect(result).toEqual({ executionId: 'remote-exec-chain-1' });
  });
});
