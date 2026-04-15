import type { DatabaseService } from './DatabaseService';
import { DatabaseService as DatabaseServiceSingleton } from './DatabaseService';

export interface ExecutionLogRecord {
  id?: number;
  taskId: string;
  batchId: string;
  stepIndex?: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface ExecutionLogQuery {
  taskId?: string;
  batchId?: string;
  stepIndex?: number;
  level?: 'info' | 'warn' | 'error';
  since?: string;
}

export interface ExecutionLogServiceOptions {
  databaseService?: Pick<DatabaseService, 'run' | 'all'>;
}

export class ExecutionLogService {
  private readonly databaseService: Pick<DatabaseService, 'run' | 'all'>;

  constructor(options: ExecutionLogServiceOptions = {}) {
    this.databaseService = options.databaseService ?? DatabaseServiceSingleton.getInstance();
  }

  append(record: ExecutionLogRecord): void {
    this.databaseService.run(
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
    const rows = this.databaseService.all<{
      id: number;
      task_id: string;
      batch_id: string;
      step_index?: number | null;
      level: 'info' | 'warn' | 'error';
      message: string;
      metadata?: string | null;
      created_at: string;
    }>(
      `SELECT id, task_id, batch_id, step_index, level, message, metadata, created_at
       FROM execution_logs
       ${whereClause}
       ORDER BY created_at ASC`,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      batchId: row.batch_id,
      stepIndex: row.step_index ?? undefined,
      level: row.level,
      message: row.message,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
    }));
  }
}
