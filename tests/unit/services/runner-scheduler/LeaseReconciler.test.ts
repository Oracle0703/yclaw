import { describe, expect, it, vi } from 'vitest';
import { LeaseReconciler } from '@main/services/runner-scheduler/LeaseReconciler';
import type { ExecutionLease, RunnerQueueItem } from '@shared/types';

const NOW = new Date('2026-04-21T00:02:00.000Z');

const lease = (overrides: Partial<ExecutionLease> = {}): ExecutionLease => ({
  id: 'lease-1',
  executionId: 'exec-1',
  queueItemId: 'queue-1',
  runnerId: 'runner-1',
  taskId: 'task-1',
  leaseToken: 'token',
  status: 'active',
  expiresAt: '2026-04-21T00:00:30.000Z',
  lastRenewedAt: '2026-04-21T00:00:00.000Z',
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
  ...overrides,
});

const queueItem = (
  idempotency: RunnerQueueItem['idempotency'],
  overrides: Partial<RunnerQueueItem> = {},
): RunnerQueueItem => ({
  id: 'queue-1',
  taskId: 'task-1',
  taskType: 'collect',
  idempotency,
  workspaceId: 'default',
  status: 'leased',
  priority: 0,
  reassignAttempts: 0,
  lastError: null,
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
  ...overrides,
});

function createRepository(overrides: {
  expiredLeases?: ExecutionLease[];
  queueItems?: RunnerQueueItem[];
  withTransaction?: boolean;
} = {}) {
  const repository = {
    listExpiredActiveLeases: vi.fn(() => overrides.expiredLeases ?? [lease()]),
    listQueueItems: vi.fn(() => overrides.queueItems ?? [queueItem('idempotent')]),
    saveExecutionLease: vi.fn((next: ExecutionLease) => next),
    saveQueueItem: vi.fn((next: RunnerQueueItem) => next),
    saveDispatchEvent: vi.fn((event) => event),
  } as {
    listExpiredActiveLeases: ReturnType<typeof vi.fn>;
    listQueueItems: ReturnType<typeof vi.fn>;
    saveExecutionLease: ReturnType<typeof vi.fn>;
    saveQueueItem: ReturnType<typeof vi.fn>;
    saveDispatchEvent: ReturnType<typeof vi.fn>;
    transaction?: ReturnType<typeof vi.fn>;
  };

  if (overrides.withTransaction) {
    repository.transaction = vi.fn((work: () => void) => work());
  }

  return repository;
}

describe('LeaseReconciler', () => {
  it('requeues idempotent orphaned work and emits reassign event metadata with next attempts', () => {
    const repository = createRepository({
      queueItems: [queueItem('idempotent', { reassignAttempts: 0, status: 'leased' })],
    });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW });

    reconciler.reconcile();

    expect(repository.saveExecutionLease).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lease-1', status: 'orphaned', updatedAt: NOW.toISOString() }),
    );
    expect(repository.saveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'queue-1',
        status: 'queued',
        reassignAttempts: 1,
        lastError: 'Previous runner lease expired; requeued for reassignment',
        updatedAt: NOW.toISOString(),
      }),
    );
    expect(repository.saveDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'reassign',
        queueItemId: 'queue-1',
        executionId: 'exec-1',
        message: 'Idempotent orphaned execution requeued',
        metadata: expect.objectContaining({ idempotency: 'idempotent', reassignAttempts: 1 }),
      }),
    );
  });

  it('marks idempotent task terminal once max reassign attempts reached', () => {
    const repository = createRepository({
      queueItems: [queueItem('idempotent', { reassignAttempts: 2, status: 'dispatching' })],
    });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW, maxReassignAttempts: 2 });

    reconciler.reconcile();

    expect(repository.saveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'terminal',
        reassignAttempts: 2,
        lastError: 'Execution orphaned; idempotent task reached maximum reassignment attempts',
      }),
    );
    expect(repository.saveDispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'orphan' }));
  });

  it('marks non-idempotent tasks terminal without automatic requeue', () => {
    const repository = createRepository({
      queueItems: [queueItem('non-idempotent')],
    });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW });

    reconciler.reconcile();

    expect(repository.saveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'terminal',
        lastError: 'Execution orphaned; task idempotency does not allow automatic reassignment',
      }),
    );
  });

  it('marks unknown idempotency tasks terminal without automatic requeue', () => {
    const repository = createRepository({
      queueItems: [queueItem('unknown')],
    });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW });

    reconciler.reconcile();

    expect(repository.saveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'terminal',
        lastError: 'Execution orphaned; task idempotency does not allow automatic reassignment',
      }),
    );
  });

  it('snapshots queue items once per reconcile', () => {
    const repository = createRepository({
      expiredLeases: [lease({ id: 'lease-1', queueItemId: 'queue-1' }), lease({ id: 'lease-2', queueItemId: 'queue-2' })],
      queueItems: [queueItem('idempotent', { id: 'queue-1' }), queueItem('idempotent', { id: 'queue-2' })],
    });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW });

    reconciler.reconcile();

    expect(repository.listQueueItems).toHaveBeenCalledTimes(1);
  });

  it('handles duplicate expired leases for same queue item only once', () => {
    const repository = createRepository({
      expiredLeases: [lease({ id: 'lease-1' }), lease({ id: 'lease-2' })],
      queueItems: [queueItem('idempotent', { id: 'queue-1', status: 'dispatching' })],
    });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW });

    reconciler.reconcile();

    expect(repository.saveExecutionLease).toHaveBeenCalledTimes(2);
    expect(repository.saveQueueItem).toHaveBeenCalledTimes(1);
    expect(repository.saveDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('skips queue mutation when queue item is not lease-owned', () => {
    const repository = createRepository({
      queueItems: [queueItem('idempotent', { status: 'queued' })],
    });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW });

    reconciler.reconcile();

    expect(repository.saveExecutionLease).toHaveBeenCalledWith(expect.objectContaining({ status: 'orphaned' }));
    expect(repository.saveQueueItem).not.toHaveBeenCalled();
    expect(repository.saveDispatchEvent).not.toHaveBeenCalled();
  });

  it('uses repository transaction when available', () => {
    const repository = createRepository({ withTransaction: true });
    const reconciler = new LeaseReconciler({ repository, now: () => NOW });

    reconciler.reconcile();

    expect(repository.transaction).toHaveBeenCalledTimes(1);
  });
});
