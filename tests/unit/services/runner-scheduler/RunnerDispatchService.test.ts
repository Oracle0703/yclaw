import { describe, expect, it, vi } from 'vitest';
import { LocalRunnerAdapter } from '@main/services/runner-scheduler/RunnerAdapters';
import { RunnerDispatchService } from '@main/services/runner-scheduler/RunnerDispatchService';
import type { RunnerNode, RunnerQueueItem } from '@shared/types';

const queueItem: RunnerQueueItem = {
  id: 'queue-1',
  taskId: 'task-1',
  taskType: 'collect',
  idempotency: 'idempotent',
  workspaceId: 'default',
  status: 'queued',
  priority: 0,
  reassignAttempts: 0,
  lastError: null,
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
};

const runner = (id: string, runningCount: number): RunnerNode => ({
  id,
  kind: 'local',
  name: id,
  workspaceId: 'default',
  status: 'online',
  capabilities: ['browser-automation'],
  maxConcurrency: 4,
  runningCount,
  cpuUsage: 0.1,
  memoryUsage: 0.1,
  heartbeatLatencyMs: 10,
  recentFailureRate: 0,
  lastHeartbeatAt: '2026-04-21T00:00:00.000Z',
  lastSeenAt: '2026-04-21T00:00:00.000Z',
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
});

describe('RunnerDispatchService', () => {
  it('dispatches queued work to lowest score runner and creates a lease', async () => {
    const queue = {
      peekNext: vi.fn(() => queueItem),
      markDispatching: vi.fn((item) => ({ ...item, status: 'dispatching' })),
      markQueued: vi.fn(),
      markTerminal: vi.fn(),
      advanceCursor: vi.fn(),
    };
    const registry = { listSchedulable: vi.fn(() => [runner('busy', 3), runner('idle', 0)]) };
    const leaseService = { createLease: vi.fn((input) => ({ id: 'lease-1', ...input })) };
    const events = { saveDispatchEvent: vi.fn((event) => event) };
    const adapter = { dispatch: vi.fn().mockResolvedValue({ executionId: 'exec-1' }) };
    const service = new RunnerDispatchService({
      queue,
      registry,
      leaseService,
      adapters: { local: adapter, remote: adapter },
      events,
    });

    await service.tick();

    expect(adapter.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        runnerId: 'idle',
        queueItem: expect.objectContaining({ id: queueItem.id, status: 'dispatching' }),
      }),
    );
    expect(leaseService.createLease).toHaveBeenCalledWith(
      expect.objectContaining({ runnerId: 'idle', executionId: 'exec-1' }),
    );
    expect(queue.advanceCursor).toHaveBeenCalled();
  });

  it('does nothing when queue is empty', async () => {
    const queue = {
      peekNext: vi.fn(() => null),
      markDispatching: vi.fn(),
      markQueued: vi.fn(),
      markTerminal: vi.fn(),
      advanceCursor: vi.fn(),
    };
    const registry = { listSchedulable: vi.fn() };
    const leaseService = { createLease: vi.fn() };
    const events = { saveDispatchEvent: vi.fn((event) => event) };
    const adapter = { dispatch: vi.fn() };
    const service = new RunnerDispatchService({
      queue,
      registry,
      leaseService,
      adapters: { local: adapter, remote: adapter },
      events,
    });

    await service.tick();

    expect(registry.listSchedulable).not.toHaveBeenCalled();
    expect(queue.markDispatching).not.toHaveBeenCalled();
    expect(queue.advanceCursor).not.toHaveBeenCalled();
  });

  it('advances cursor when no schedulable runner is available', async () => {
    const queue = {
      peekNext: vi.fn(() => queueItem),
      markDispatching: vi.fn((item) => ({ ...item, status: 'dispatching' })),
      markQueued: vi.fn(),
      markTerminal: vi.fn(),
      advanceCursor: vi.fn(),
    };
    const registry = { listSchedulable: vi.fn(() => [runner('full', 4)]) };
    const leaseService = { createLease: vi.fn() };
    const events = { saveDispatchEvent: vi.fn((event) => event) };
    const adapter = { dispatch: vi.fn() };
    const service = new RunnerDispatchService({
      queue,
      registry,
      leaseService,
      adapters: { local: adapter, remote: adapter },
      events,
    });

    await service.tick();

    expect(queue.markDispatching).not.toHaveBeenCalled();
    expect(adapter.dispatch).not.toHaveBeenCalled();
    expect(queue.advanceCursor).toHaveBeenCalledTimes(1);
  });

  it('uses remote adapter for remote runner', async () => {
    const remoteRunner: RunnerNode = {
      ...runner('remote-idle', 0),
      kind: 'remote',
    };
    const queue = {
      peekNext: vi.fn(() => queueItem),
      markDispatching: vi.fn((item) => ({ ...item, status: 'dispatching' })),
      markQueued: vi.fn(),
      markTerminal: vi.fn(),
      advanceCursor: vi.fn(),
    };
    const registry = { listSchedulable: vi.fn(() => [remoteRunner]) };
    const leaseService = { createLease: vi.fn((input) => ({ id: 'lease-1', ...input })) };
    const events = { saveDispatchEvent: vi.fn((event) => event) };
    const localAdapter = { dispatch: vi.fn().mockResolvedValue({ executionId: 'exec-local' }) };
    const remoteAdapter = { dispatch: vi.fn().mockResolvedValue({ executionId: 'exec-remote' }) };
    const service = new RunnerDispatchService({
      queue,
      registry,
      leaseService,
      adapters: { local: localAdapter, remote: remoteAdapter },
      events,
    });

    await service.tick();

    expect(remoteAdapter.dispatch).toHaveBeenCalledTimes(1);
    expect(localAdapter.dispatch).not.toHaveBeenCalled();
  });

  it('requeues item with lastError when dispatch rejects and rethrows', async () => {
    const dispatchingItem = { ...queueItem, status: 'dispatching' as const };
    const queue = {
      peekNext: vi.fn(() => queueItem),
      markDispatching: vi.fn(() => dispatchingItem),
      markQueued: vi.fn((item, lastError) => ({ ...item, status: 'queued', lastError })),
      markTerminal: vi.fn(),
      advanceCursor: vi.fn(),
    };
    const registry = { listSchedulable: vi.fn(() => [runner('idle', 0)]) };
    const leaseService = { createLease: vi.fn() };
    const events = { saveDispatchEvent: vi.fn((event) => event) };
    const adapter = { dispatch: vi.fn().mockRejectedValue(new Error('dispatch failed')) };
    const service = new RunnerDispatchService({
      queue,
      registry,
      leaseService,
      adapters: { local: adapter, remote: adapter },
      events,
    });

    await expect(service.tick()).rejects.toThrow('dispatch failed');
    expect(queue.markQueued).toHaveBeenCalledWith(
      dispatchingItem,
      expect.stringContaining('dispatch failed'),
    );
    expect(queue.markTerminal).not.toHaveBeenCalled();
    expect(leaseService.createLease).not.toHaveBeenCalled();
    expect(queue.advanceCursor).toHaveBeenCalledTimes(1);
  });

  it('writes orphan event with execution anchor when lease creation fails', async () => {
    const dispatchingItem = { ...queueItem, status: 'dispatching' as const };
    const queue = {
      peekNext: vi.fn(() => queueItem),
      markDispatching: vi.fn(() => dispatchingItem),
      markQueued: vi.fn(),
      markTerminal: vi.fn((item, lastError) => ({ ...item, status: 'terminal', lastError })),
      advanceCursor: vi.fn(),
    };
    const registry = { listSchedulable: vi.fn(() => [runner('idle', 0)]) };
    const events = {
      saveDispatchEvent: vi.fn((event) => event),
    };
    const leaseService = {
      createLease: vi.fn(() => {
        throw new Error('lease create failed');
      }),
    };
    const adapter = { dispatch: vi.fn().mockResolvedValue({ executionId: 'exec-1' }) };
    const service = new RunnerDispatchService({
      queue,
      registry,
      leaseService,
      adapters: { local: adapter, remote: adapter },
      events,
    });

    await expect(service.tick()).rejects.toThrow('lease create failed');
    expect(events.saveDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'orphan',
        executionId: 'exec-1',
        runnerId: 'idle',
        queueItemId: queueItem.id,
        metadata: expect.objectContaining({ failurePhase: 'lease_create' }),
      }),
    );
    expect(queue.markTerminal).toHaveBeenCalledWith(
      dispatchingItem,
      expect.stringContaining('lease create failed'),
    );
    expect(queue.markQueued).not.toHaveBeenCalled();
    expect(queue.advanceCursor).toHaveBeenCalledTimes(1);
  });

  it('includes lease error, executionId, and event write error when event save fails', async () => {
    const dispatchingItem = { ...queueItem, status: 'dispatching' as const };
    const queue = {
      peekNext: vi.fn(() => queueItem),
      markDispatching: vi.fn(() => dispatchingItem),
      markQueued: vi.fn(),
      markTerminal: vi.fn((item, lastError) => ({ ...item, status: 'terminal', lastError })),
      advanceCursor: vi.fn(),
    };
    const registry = { listSchedulable: vi.fn(() => [runner('idle', 0)]) };
    const events = {
      saveDispatchEvent: vi.fn(() => {
        throw new Error('event write failed');
      }),
    };
    const leaseService = {
      createLease: vi.fn(() => {
        throw new Error('lease create failed');
      }),
    };
    const adapter = { dispatch: vi.fn().mockResolvedValue({ executionId: 'exec-1' }) };
    const service = new RunnerDispatchService({
      queue,
      registry,
      leaseService,
      adapters: { local: adapter, remote: adapter },
      events,
    });

    await expect(service.tick()).rejects.toThrow(/lease create failed[\s\S]*exec-1[\s\S]*event write failed/);
    expect(queue.markTerminal).toHaveBeenCalledWith(
      dispatchingItem,
      expect.stringContaining('lease create failed'),
    );
    expect(queue.markQueued).not.toHaveBeenCalled();
    expect(queue.advanceCursor).toHaveBeenCalledTimes(1);
  });
});

describe('LocalRunnerAdapter', () => {
  it('creates unique execution ids per dispatch with local prefix', async () => {
    const adapter = new LocalRunnerAdapter();
    const input = {
      runnerId: 'local-1',
      runner: runner('local-1', 0),
      queueItem,
    };

    const first = await adapter.dispatch(input);
    const second = await adapter.dispatch(input);

    expect(first.executionId).toMatch(/^local-/);
    expect(second.executionId).toMatch(/^local-/);
    expect(first.executionId).not.toBe(second.executionId);
  });
});
