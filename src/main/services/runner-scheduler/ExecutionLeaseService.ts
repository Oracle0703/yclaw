import crypto from 'crypto';
import { RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';
import type { ExecutionLease } from '@shared/types';

interface RepositoryLike {
  saveExecutionLease(lease: ExecutionLease): ExecutionLease;
}

interface CreateLeaseInput {
  executionId: string;
  queueItemId: string;
  runnerId: string;
  taskId: string;
}

export class ExecutionLeaseService {
  constructor(
    private readonly options: {
      repository: RepositoryLike;
      now?: () => Date;
      leaseTtlMs?: number;
    },
  ) {}

  createLease(input: CreateLeaseInput): ExecutionLease {
    const now = this.options.now?.() ?? new Date();
    const timestamp = now.toISOString();
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
      lastRenewedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.options.repository.saveExecutionLease(lease);
  }
}
