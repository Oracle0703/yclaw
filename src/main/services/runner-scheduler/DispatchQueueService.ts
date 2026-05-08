import crypto from 'crypto';
import { DEFAULT_RUNNER_QUEUE_WEIGHTS } from '@shared/constants';
import type { QueueType, RunnerQueueItem, RunnerRemoteDispatch, TaskIdempotency } from '@shared/types';

interface RepositoryLike {
  listQueueItems(): RunnerQueueItem[];
  saveQueueItem(queueItem: RunnerQueueItem): RunnerQueueItem;
}

interface EnqueueInput {
  taskId: string;
  taskType: QueueType;
  idempotency: TaskIdempotency;
  workspaceId: string;
  priority?: number;
  remoteDispatch?: RunnerRemoteDispatch;
}

export class DispatchQueueService {
  private cursor = 0;

  private readonly sequence: QueueType[];

  constructor(
    private readonly options: {
      repository: RepositoryLike;
      now?: () => Date;
      weights?: Record<QueueType, number>;
    },
  ) {
    this.sequence = this.buildSequence(options.weights ?? DEFAULT_RUNNER_QUEUE_WEIGHTS);
  }

  enqueue(input: EnqueueInput): RunnerQueueItem {
    const timestamp = this.nowIso();
    return this.options.repository.saveQueueItem({
      id: crypto.randomUUID(),
      taskId: input.taskId,
      taskType: input.taskType,
      idempotency: input.idempotency,
      workspaceId: input.workspaceId,
      status: 'queued',
      priority: input.priority ?? 0,
      reassignAttempts: 0,
      lastError: null,
      remoteDispatch: input.remoteDispatch,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  peekNext(): RunnerQueueItem | null {
    const queueItems = this.options.repository.listQueueItems();
    for (let offset = 0; offset < this.sequence.length; offset += 1) {
      const queueType = this.sequence[(this.cursor + offset) % this.sequence.length];
      const item = this.firstQueuedOfTypeFrom(queueType, queueItems);
      if (item) return item;
    }
    return null;
  }

  markDispatching(item: RunnerQueueItem): RunnerQueueItem {
    return this.options.repository.saveQueueItem({
      ...item,
      status: 'dispatching',
      updatedAt: this.nowIso(),
    });
  }

  markQueued(item: RunnerQueueItem, lastError: string): RunnerQueueItem {
    return this.options.repository.saveQueueItem({
      ...item,
      status: 'queued',
      lastError,
      updatedAt: this.nowIso(),
    });
  }

  markTerminal(item: RunnerQueueItem, lastError: string): RunnerQueueItem {
    return this.options.repository.saveQueueItem({
      ...item,
      status: 'terminal',
      lastError,
      updatedAt: this.nowIso(),
    });
  }

  advanceCursor(): void {
    if (this.sequence.length === 0) {
      return;
    }
    this.cursor = (this.cursor + 1) % this.sequence.length;
  }

  private firstQueuedOfType(queueType: QueueType): RunnerQueueItem | null {
    return this.firstQueuedOfTypeFrom(queueType, this.options.repository.listQueueItems());
  }

  private firstQueuedOfTypeFrom(queueType: QueueType, queueItems: RunnerQueueItem[]): RunnerQueueItem | null {
    return (
      queueItems
        .filter((item) => item.status === 'queued' && item.taskType === queueType)
        .sort((left, right) => {
          const createdCompare = left.createdAt.localeCompare(right.createdAt);
          if (createdCompare !== 0) return createdCompare;
          return left.id.localeCompare(right.id);
        })[0] ?? null
    );
  }

  private buildSequence(weights: Record<QueueType, number>): QueueType[] {
    return (Object.entries(weights) as Array<[QueueType, number]>).flatMap(([queueType, weight]) =>
      Array.from({ length: weight }, () => queueType),
    );
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}
