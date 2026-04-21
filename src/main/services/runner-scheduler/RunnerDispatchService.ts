import crypto from 'crypto';
import type {
  ExecutionLease,
  RunnerDispatchEvent,
  RunnerKind,
  RunnerNode,
  RunnerQueueItem,
} from '@shared/types';
import { CapacityScoringService } from './CapacityScoringService';
import type { RunnerAdapter } from './RunnerAdapters';

interface QueueLike {
  peekNext(): RunnerQueueItem | null;
  markDispatching(item: RunnerQueueItem): RunnerQueueItem;
  markQueued(item: RunnerQueueItem, lastError: string): RunnerQueueItem;
  markTerminal(item: RunnerQueueItem, lastError: string): RunnerQueueItem;
  advanceCursor(): void;
}

interface RegistryLike {
  listSchedulable(workspaceId: string): RunnerNode[];
}

interface LeaseServiceLike {
  createLease(input: {
    executionId: string;
    queueItemId: string;
    runnerId: string;
    taskId: string;
  }): ExecutionLease | Promise<ExecutionLease>;
}

interface EventsLike {
  saveDispatchEvent(event: RunnerDispatchEvent): RunnerDispatchEvent;
}

export class RunnerDispatchService {
  private readonly scorer = new CapacityScoringService();

  constructor(
    private readonly options: {
      queue: QueueLike;
      registry: RegistryLike;
      leaseService: LeaseServiceLike;
      adapters: Record<RunnerKind, RunnerAdapter>;
      events: EventsLike;
    },
  ) {}

  async tick(): Promise<void> {
    const queueItem = this.options.queue.peekNext();
    if (!queueItem) {
      return;
    }

    const runners = this.options.registry.listSchedulable(queueItem.workspaceId);
    const { runner } = this.scorer.selectBest(runners);
    if (!runner) {
      this.options.queue.advanceCursor();
      return;
    }

    const dispatching = this.options.queue.markDispatching(queueItem);

    let result;
    try {
      result = await this.options.adapters[runner.kind].dispatch({
        runnerId: runner.id,
        runner,
        queueItem: dispatching,
      });
    } catch (error) {
      this.options.queue.markQueued(dispatching, this.formatFailure('dispatch failed', error));
      this.options.queue.advanceCursor();
      throw error;
    }

    try {
      await this.options.leaseService.createLease({
        executionId: result.executionId,
        queueItemId: queueItem.id,
        runnerId: runner.id,
        taskId: queueItem.taskId,
      });
    } catch (error) {
      const failureMessage = this.formatFailure('lease creation failed', error);
      this.options.queue.markTerminal(dispatching, failureMessage);
      let eventWriteError: unknown = null;
      try {
        this.saveLeaseFailureEvent({
          executionId: result.executionId,
          runnerId: runner.id,
          queueItemId: queueItem.id,
          message: failureMessage,
        });
      } catch (eventError) {
        eventWriteError = eventError;
      }
      this.options.queue.advanceCursor();
      if (eventWriteError) {
        throw new Error(
          `${failureMessage}; executionId=${result.executionId}; event write failed: ${this.errorMessage(eventWriteError)}`,
        );
      }
      throw error;
    }

    this.options.queue.advanceCursor();
  }

  private formatFailure(prefix: string, error: unknown): string {
    if (error instanceof Error) {
      return `${prefix}: ${error.message}`;
    }
    return `${prefix}: ${String(error)}`;
  }

  private saveLeaseFailureEvent(input: {
    executionId: string;
    runnerId: string;
    queueItemId: string;
    message: string;
  }): void {
    this.options.events.saveDispatchEvent({
      id: crypto.randomUUID(),
      eventType: 'orphan',
      runnerId: input.runnerId,
      queueItemId: input.queueItemId,
      executionId: input.executionId,
      message: `execution orphan risk: ${input.message}`,
      metadata: {
        failurePhase: 'lease_create',
      },
      createdAt: new Date().toISOString(),
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
