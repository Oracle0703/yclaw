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

  it('returns null when queue has no queued items', () => {
    const repository = {
      listQueueItems: vi.fn(() => [] as RunnerQueueItem[]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({ repository });

    expect(service.peekNext()).toBeNull();
  });

  it('uses empty sequence when all weights are zero', () => {
    const queueItem = item('1', 'inspect');
    const repository = {
      listQueueItems: vi.fn(() => [queueItem]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({
      repository,
      weights: { inspect: 0, collect: 0, replay: 0 },
    });

    expect(service.peekNext()).toBeNull();
  });

  it('does not break cursor when sequence is empty', () => {
    const repository = {
      listQueueItems: vi.fn(() => [] as RunnerQueueItem[]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({
      repository,
      weights: { inspect: 0, collect: 0, replay: 0 },
    });

    service.advanceCursor();
    service.advanceCursor();

    expect(Number.isNaN((service as { cursor: number }).cursor)).toBe(false);
    expect(service.peekNext()).toBeNull();
  });

  it('peeks from snapshot once and probes forward to next non-empty queue', () => {
    const collectItem = item('2', 'collect');
    const repository = {
      listQueueItems: vi.fn(() => [collectItem]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({
      repository,
      weights: { inspect: 1, collect: 1, replay: 0 },
    });

    expect(service.peekNext()).toEqual(collectItem);
    expect(repository.listQueueItems).toHaveBeenCalledTimes(1);
  });

  it('breaks ties by id when createdAt is the same', () => {
    const sameTime = '2026-04-21T00:00:01.000Z';
    const repository = {
      listQueueItems: vi.fn(() => [
        { ...item('2', 'inspect'), createdAt: sameTime, updatedAt: sameTime },
        { ...item('1', 'inspect'), createdAt: sameTime, updatedAt: sameTime },
      ]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({ repository });

    expect(service.peekNext()?.id).toBe('1');
  });

  it('marks item as dispatching with updated timestamp and saves it', () => {
    const queueItem = item('1', 'inspect');
    const repository = {
      listQueueItems: vi.fn(() => [queueItem]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({
      repository,
      now: () => new Date('2026-04-21T00:00:09.000Z'),
    });

    const dispatched = service.markDispatching(queueItem);

    expect(dispatched.status).toBe('dispatching');
    expect(dispatched.updatedAt).toBe('2026-04-21T00:00:09.000Z');
    expect(repository.saveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: queueItem.id,
        status: 'dispatching',
        updatedAt: '2026-04-21T00:00:09.000Z',
      }),
    );
  });

  it('requeues dispatching item with error and updated timestamp', () => {
    const dispatchingItem = { ...item('1', 'inspect'), status: 'dispatching' as const };
    const repository = {
      listQueueItems: vi.fn(() => [dispatchingItem]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({
      repository,
      now: () => new Date('2026-04-21T00:00:10.000Z'),
    });

    const requeued = service.markQueued(dispatchingItem, 'dispatch failed');

    expect(requeued.status).toBe('queued');
    expect(requeued.lastError).toBe('dispatch failed');
    expect(requeued.updatedAt).toBe('2026-04-21T00:00:10.000Z');
    expect(repository.saveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: dispatchingItem.id,
        status: 'queued',
        lastError: 'dispatch failed',
        updatedAt: '2026-04-21T00:00:10.000Z',
      }),
    );
  });

  it('marks dispatching item terminal with error and updated timestamp', () => {
    const dispatchingItem = { ...item('1', 'inspect'), status: 'dispatching' as const };
    const repository = {
      listQueueItems: vi.fn(() => [dispatchingItem]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({
      repository,
      now: () => new Date('2026-04-21T00:00:11.000Z'),
    });

    const terminal = service.markTerminal(dispatchingItem, 'lease create failed');

    expect(terminal.status).toBe('terminal');
    expect(terminal.lastError).toBe('lease create failed');
    expect(terminal.updatedAt).toBe('2026-04-21T00:00:11.000Z');
    expect(repository.saveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: dispatchingItem.id,
        status: 'terminal',
        lastError: 'lease create failed',
        updatedAt: '2026-04-21T00:00:11.000Z',
      }),
    );
  });

  it('always generates queue item id on enqueue', () => {
    const repository = {
      listQueueItems: vi.fn(() => [] as RunnerQueueItem[]),
      saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    };
    const service = new DispatchQueueService({
      repository,
      now: () => new Date('2026-04-21T00:00:01.000Z'),
    });

    const queued = service.enqueue({
      taskId: 'task-100',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'default',
      remoteDispatch: {
        runnerConnectionId: 'conn-1',
        revisionId: 'rev-1',
        sessionId: 'session-1',
      },
    });

    expect(queued.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(queued.status).toBe('queued');
    expect(queued.remoteDispatch).toEqual({
      runnerConnectionId: 'conn-1',
      revisionId: 'rev-1',
      sessionId: 'session-1',
    });
  });
});
