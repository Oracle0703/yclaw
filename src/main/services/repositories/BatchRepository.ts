import type { StepResult, TaskBatch, TaskBreakpoint } from '@shared/types';

interface BatchRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface BatchRow {
  id: string;
  task_id: string;
  status: TaskBatch['status'];
  started_at?: string | null;
  finished_at?: string | null;
  step_results: string;
  error?: string | null;
  breakpoint_json?: string | null;
  created_at: string;
}

export class BatchRepository {
  constructor(private readonly executor: BatchRepositoryExecutor) {}

  insertBatch(
    batch: TaskBatch,
    options?: {
      sourceBatchId?: string;
      reason?: 'retry' | 'manual' | 'scheduled';
    },
  ): void {
    this.executor.run(
      `INSERT INTO task_batches (
        id, task_id, status, step_results, error, breakpoint_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        batch.id,
        batch.taskId,
        batch.status,
        JSON.stringify(batch.stepResults),
        batch.error ?? null,
        options?.reason || options?.sourceBatchId ? JSON.stringify(options) : null,
        batch.createdAt,
      ],
    );
  }

  startBatch(batchId: string, startedAt: string): void {
    this.executor.run('UPDATE task_batches SET status = ?, started_at = ? WHERE id = ?', [
      'running',
      startedAt,
      batchId,
    ]);
  }

  finishBatch(batchId: string, stepResults: StepResult[], finishedAt: string): void {
    this.executor.run(
      'UPDATE task_batches SET status = ?, finished_at = ?, step_results = ? WHERE id = ?',
      ['success', finishedAt, JSON.stringify(stepResults), batchId],
    );
  }

  failBatch(batchId: string, error: string, breakpoint: TaskBreakpoint | undefined, finishedAt: string): void {
    this.executor.run(
      'UPDATE task_batches SET status = ?, finished_at = ?, error = ?, breakpoint_json = ? WHERE id = ?',
      ['failed', finishedAt, error, breakpoint ? JSON.stringify(breakpoint) : null, batchId],
    );
  }

  getBatch(batchId: string): TaskBatch | null {
    const row = this.executor.get<BatchRow>(
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

    return row ? mapBatchRow(row) : null;
  }

  listBatchesByTask(taskId: string): TaskBatch[] {
    return this.executor
      .all<BatchRow>(
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
      )
      .map(mapBatchRow);
  }
}

function mapBatchRow(row: BatchRow): TaskBatch {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    stepResults: parseJson<StepResult[]>(row.step_results, []),
    error: row.error ?? null,
    breakpoint: row.breakpoint_json
      ? parseJson<TaskBreakpoint | null>(row.breakpoint_json, null)
      : null,
    createdAt: row.created_at,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
