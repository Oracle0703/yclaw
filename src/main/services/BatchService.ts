import { randomUUID } from 'crypto';
import type { DatabaseService } from './DatabaseService';
import type { StepResult, TaskBatch, TaskBreakpoint } from '@shared/types';
import { DatabaseService as DatabaseServiceSingleton } from './DatabaseService';

export interface CreateBatchOptions {
  sourceBatchId?: string;
  reason?: 'retry' | 'manual' | 'scheduled';
}

export interface BatchServiceOptions {
  databaseService?: Pick<DatabaseService, 'run' | 'get' | 'all'>;
}

export class BatchService {
  private readonly databaseService: Pick<DatabaseService, 'run' | 'get' | 'all'>;

  constructor(options: BatchServiceOptions = {}) {
    this.databaseService = options.databaseService ?? DatabaseServiceSingleton.getInstance();
  }

  createBatch(taskId: string, options: CreateBatchOptions = {}): TaskBatch {
    const batch: TaskBatch = {
      id: randomUUID(),
      taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      stepResults: [],
    };

    this.databaseService.run(
      `INSERT INTO task_batches (
        id, task_id, status, step_results, error, breakpoint_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        batch.id,
        batch.taskId,
        batch.status,
        JSON.stringify(batch.stepResults),
        options.reason ?? null,
        options.sourceBatchId ? JSON.stringify({ sourceBatchId: options.sourceBatchId }) : null,
        batch.createdAt,
      ],
    );

    return batch;
  }

  startBatch(batchId: string): void {
    this.databaseService.run(
      'UPDATE task_batches SET status = ?, started_at = ? WHERE id = ?',
      ['running', new Date().toISOString(), batchId],
    );
  }

  finishBatch(batchId: string, stepResults: StepResult[]): void {
    this.databaseService.run(
      'UPDATE task_batches SET status = ?, finished_at = ?, step_results = ? WHERE id = ?',
      ['success', new Date().toISOString(), JSON.stringify(stepResults), batchId],
    );
  }

  failBatch(batchId: string, error: string, breakpoint?: TaskBreakpoint): void {
    this.databaseService.run(
      'UPDATE task_batches SET status = ?, finished_at = ?, error = ?, breakpoint_json = ? WHERE id = ?',
      ['failed', new Date().toISOString(), error, breakpoint ? JSON.stringify(breakpoint) : null, batchId],
    );
  }

  getBatch(batchId: string): TaskBatch | null {
    const row = this.databaseService.get<{
      id: string;
      task_id: string;
      status: TaskBatch['status'];
      started_at?: string | null;
      finished_at?: string | null;
      step_results: string;
      error?: string | null;
      breakpoint_json?: string | null;
      created_at: string;
    }>(
      `SELECT
        id,
        task_id,
        status,
        started_at,
        finished_at,
        step_results,
        error,
        breakpoint_json,
        created_at
      FROM task_batches
      WHERE id = ?`,
      [batchId],
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      taskId: row.task_id,
      status: row.status,
      startedAt: row.started_at ?? null,
      finishedAt: row.finished_at ?? null,
      stepResults: JSON.parse(row.step_results) as StepResult[],
      error: row.error ?? null,
      breakpoint: row.breakpoint_json
        ? (JSON.parse(row.breakpoint_json) as TaskBreakpoint)
        : null,
      createdAt: row.created_at,
    };
  }

  listBatchesByTask(taskId: string): TaskBatch[] {
    const rows = this.databaseService.all<{
      id: string;
      task_id: string;
      status: TaskBatch['status'];
      started_at?: string | null;
      finished_at?: string | null;
      step_results: string;
      error?: string | null;
      breakpoint_json?: string | null;
      created_at: string;
    }>(
      `SELECT
        id,
        task_id,
        status,
        started_at,
        finished_at,
        step_results,
        error,
        breakpoint_json,
        created_at
      FROM task_batches
      WHERE task_id = ?
      ORDER BY created_at DESC`,
      [taskId],
    );

    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      status: row.status,
      startedAt: row.started_at ?? null,
      finishedAt: row.finished_at ?? null,
      stepResults: JSON.parse(row.step_results) as StepResult[],
      error: row.error ?? null,
      breakpoint: row.breakpoint_json
        ? (JSON.parse(row.breakpoint_json) as TaskBreakpoint)
        : null,
      createdAt: row.created_at,
    }));
  }
}
