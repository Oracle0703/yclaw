import { describe, expect, it, vi } from 'vitest';
import { ExecutionLeaseService } from '@main/services/runner-scheduler/ExecutionLeaseService';
import { RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('ExecutionLeaseService', () => {
  it('creates an active lease with configured ttl', () => {
    const repository = { saveExecutionLease: vi.fn((lease) => lease) };
    const service = new ExecutionLeaseService({
      repository,
      now: () => new Date('2026-04-21T00:00:00.000Z'),
      leaseTtlMs: 45_000,
    });

    const lease = service.createLease({
      executionId: 'exec-1',
      queueItemId: 'queue-1',
      runnerId: 'runner-1',
      taskId: 'task-1',
    });

    expect(lease.status).toBe('active');
    expect(lease.expiresAt).toBe('2026-04-21T00:00:45.000Z');
  });

  it('falls back to default ttl and generates identifiers', () => {
    const repository = { saveExecutionLease: vi.fn((lease) => lease) };
    const now = new Date('2026-04-21T00:00:00.000Z');
    const service = new ExecutionLeaseService({
      repository,
      now: () => now,
    });

    const lease = service.createLease({
      executionId: 'exec-2',
      queueItemId: 'queue-2',
      runnerId: 'runner-2',
      taskId: 'task-2',
    });

    expect(lease.expiresAt).toBe(new Date(now.getTime() + RUNNER_SCHEDULER_DEFAULTS.leaseTtlMs).toISOString());
    expect(lease.id).toMatch(UUID_PATTERN);
    expect(lease.leaseToken).toMatch(UUID_PATTERN);
    expect(lease.lastRenewedAt).toBe(now.toISOString());
    expect(lease.createdAt).toBe(now.toISOString());
    expect(lease.updatedAt).toBe(now.toISOString());
  });

  it('reuses one computed timestamp across lease timestamps', () => {
    const toISOString = vi.fn(() => '2026-04-21T00:00:00.000Z');
    const repository = { saveExecutionLease: vi.fn((lease) => lease) };
    const service = new ExecutionLeaseService({
      repository,
      now: () =>
        ({
          getTime: () => Date.parse('2026-04-21T00:00:00.000Z'),
          toISOString,
        }) as Date,
    });

    service.createLease({
      executionId: 'exec-3',
      queueItemId: 'queue-3',
      runnerId: 'runner-3',
      taskId: 'task-3',
    });

    expect(toISOString).toHaveBeenCalledTimes(1);
  });
});
