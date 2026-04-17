import type { ExecutionLogQuery, ExecutionLogRecord } from '../ExecutionLogService';

interface ExecutionLogRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface ExecutionLogRow {
  id: number;
  task_id: string;
  batch_id: string;
  step_index?: number | null;
  level: ExecutionLogRecord['level'];
  message: string;
  metadata?: string | null;
  created_at: string;
}

export class ExecutionLogRepository {
  constructor(private readonly executor: ExecutionLogRepositoryExecutor) {}

  append(record: ExecutionLogRecord): void {
    this.executor.run(
      `INSERT INTO execution_logs (
        task_id, batch_id, step_index, level, message, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.taskId,
        record.batchId,
        record.stepIndex ?? null,
        record.level,
        record.message,
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.createdAt ?? new Date().toISOString(),
      ],
    );
  }

  query(query: ExecutionLogQuery = {}): ExecutionLogRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.taskId) {
      conditions.push('task_id = ?');
      params.push(query.taskId);
    }
    if (query.batchId) {
      conditions.push('batch_id = ?');
      params.push(query.batchId);
    }
    if (typeof query.stepIndex === 'number') {
      conditions.push('step_index = ?');
      params.push(query.stepIndex);
    }
    if (query.level) {
      conditions.push('level = ?');
      params.push(query.level);
    }
    if (query.since) {
      conditions.push('created_at >= ?');
      params.push(query.since);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.executor
      .all<ExecutionLogRow>(
        `SELECT id, task_id, batch_id, step_index, level, message, metadata, created_at
         FROM execution_logs
         ${whereClause}
         ORDER BY created_at ASC`,
        params,
      )
      .map((row) => ({
        id: row.id,
        taskId: row.task_id,
        batchId: row.batch_id,
        stepIndex: row.step_index ?? undefined,
        level: row.level,
        message: row.message,
        metadata: row.metadata ? parseJson<Record<string, unknown>>(row.metadata, {}) : undefined,
        createdAt: row.created_at,
      }));
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
