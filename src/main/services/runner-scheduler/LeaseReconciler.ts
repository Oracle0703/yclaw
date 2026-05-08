import crypto from 'crypto';
import { RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';
import type { ExecutionLease, RunnerDispatchEvent, RunnerQueueItem } from '@shared/types';

interface RepositoryLike {
  listExpiredActiveLeases(nowIso: string): ExecutionLease[];
  listQueueItems(): RunnerQueueItem[];
  saveExecutionLease(lease: ExecutionLease): ExecutionLease;
  saveQueueItem(item: RunnerQueueItem): RunnerQueueItem;
  saveDispatchEvent(event: RunnerDispatchEvent): RunnerDispatchEvent;
  transaction?<T>(work: () => T): T;
}

export class LeaseReconciler {
  constructor(
    private readonly options: {
      repository: RepositoryLike;
      now?: () => Date;
      maxReassignAttempts?: number;
    },
  ) {}

  reconcile(): void {
    const now = this.options.now?.() ?? new Date();
    const nowIso = now.toISOString();
    const expiredLeases = this.options.repository.listExpiredActiveLeases(nowIso);
    if (expiredLeases.length === 0) {
      return;
    }

    const queueItemsById = new Map(
      this.options.repository.listQueueItems().map((queueItem) => [queueItem.id, queueItem]),
    );
    const processedQueueItemIds = new Set<string>();

    for (const lease of expiredLeases) {
      this.inUnitOfWork(() => {
        this.markLeaseOrphaned(lease, nowIso);

        if (processedQueueItemIds.has(lease.queueItemId)) {
          return;
        }
        processedQueueItemIds.add(lease.queueItemId);

        const item = queueItemsById.get(lease.queueItemId);
        if (!item) {
          return;
        }

        const next = this.reconcileQueueItem(item, nowIso);
        if (!next) {
          return;
        }

        this.options.repository.saveQueueItem(next.item);
        this.event(next.eventType, lease, next.item, next.message, nowIso);
      });
    }
  }

  private markLeaseOrphaned(lease: ExecutionLease, nowIso: string): void {
    this.options.repository.saveExecutionLease({
      ...lease,
      status: 'orphaned',
      updatedAt: nowIso,
    });
  }

  private event(
    eventType: RunnerDispatchEvent['eventType'],
    lease: ExecutionLease,
    item: RunnerQueueItem,
    message: string,
    nowIso: string,
  ): void {
    this.options.repository.saveDispatchEvent({
      id: crypto.randomUUID(),
      eventType,
      runnerId: lease.runnerId,
      queueItemId: item.id,
      executionId: lease.executionId,
      message,
      metadata: { idempotency: item.idempotency, reassignAttempts: item.reassignAttempts },
      createdAt: nowIso,
    });
  }

  private maxReassignAttempts(): number {
    return this.options.maxReassignAttempts ?? RUNNER_SCHEDULER_DEFAULTS.maxReassignAttempts;
  }

  private inUnitOfWork<T>(work: () => T): T {
    if (!this.options.repository.transaction) {
      return work();
    }
    return this.options.repository.transaction(work);
  }

  private reconcileQueueItem(
    item: RunnerQueueItem,
    nowIso: string,
  ): {
    item: RunnerQueueItem;
    eventType: RunnerDispatchEvent['eventType'];
    message: string;
  } | null {
    if (!this.isLeaseOwnedStatus(item.status)) {
      return null;
    }

    if (item.idempotency === 'idempotent') {
      if (item.reassignAttempts < this.maxReassignAttempts()) {
        return {
          item: {
            ...item,
            status: 'queued',
            reassignAttempts: item.reassignAttempts + 1,
            lastError: 'Previous runner lease expired; requeued for reassignment',
            updatedAt: nowIso,
          },
          eventType: 'reassign',
          message: 'Idempotent orphaned execution requeued',
        };
      }

      return {
        item: {
          ...item,
          status: 'terminal',
          lastError: 'Execution orphaned; idempotent task reached maximum reassignment attempts',
          updatedAt: nowIso,
        },
        eventType: 'orphan',
        message: 'Orphaned execution requires manual handling',
      };
    }

    return {
      item: {
        ...item,
        status: 'terminal',
        lastError: 'Execution orphaned; task idempotency does not allow automatic reassignment',
        updatedAt: nowIso,
      },
      eventType: 'orphan',
      message: 'Orphaned execution requires manual handling',
    };
  }

  private isLeaseOwnedStatus(status: RunnerQueueItem['status']): boolean {
    return status === 'leased' || status === 'dispatching';
  }
}
