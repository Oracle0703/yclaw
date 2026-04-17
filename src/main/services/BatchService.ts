import { randomUUID } from 'crypto';
import type { StepResult, TaskBatch, TaskBreakpoint } from '@shared/types';
import { BatchRepository } from './repositories';

export interface CreateBatchOptions {
  sourceBatchId?: string;
  reason?: 'retry' | 'manual' | 'scheduled';
}

export interface BatchServiceOptions {
  batchRepository?: Pick<
    BatchRepository,
    'insertBatch' | 'startBatch' | 'finishBatch' | 'failBatch' | 'getBatch' | 'listBatchesByTask'
  >;
}

export class BatchService {
  private readonly batchRepository: Pick<
    BatchRepository,
    'insertBatch' | 'startBatch' | 'finishBatch' | 'failBatch' | 'getBatch' | 'listBatchesByTask'
  >;

  constructor(options: BatchServiceOptions = {}) {
    if (!options.batchRepository) {
      throw new Error('batchRepository is required');
    }

    this.batchRepository = options.batchRepository;
  }

  createBatch(taskId: string, options: CreateBatchOptions = {}): TaskBatch {
    const batch: TaskBatch = {
      id: randomUUID(),
      taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      stepResults: [],
    };

    this.batchRepository.insertBatch(batch, options);

    return batch;
  }

  startBatch(batchId: string): void {
    this.batchRepository.startBatch(batchId, new Date().toISOString());
  }

  finishBatch(batchId: string, stepResults: StepResult[]): void {
    this.batchRepository.finishBatch(batchId, stepResults, new Date().toISOString());
  }

  failBatch(batchId: string, error: string, breakpoint?: TaskBreakpoint): void {
    this.batchRepository.failBatch(batchId, error, breakpoint, new Date().toISOString());
  }

  getBatch(batchId: string): TaskBatch | null {
    return this.batchRepository.getBatch(batchId);
  }

  listBatchesByTask(taskId: string): TaskBatch[] {
    return this.batchRepository.listBatchesByTask(taskId);
  }
}
