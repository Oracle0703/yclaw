import type { AlertRecord } from '@shared/types';
import type { AlertQuery } from '../AlertService';

interface AlertRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface AlertRow {
  id: string;
  task_id: string;
  batch_id?: string | null;
  message: string;
  created_at: string;
  read: number;
}

export class AlertRepository {
  constructor(private readonly executor: AlertRepositoryExecutor) {}

  listAlerts(query: AlertQuery = {}): AlertRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.taskId) {
      conditions.push('task_id = ?');
      params.push(query.taskId);
    }
    if (query.unreadOnly) {
      conditions.push('read = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.executor
      .all<AlertRow>(
        `SELECT id, task_id, batch_id, message, created_at, read
         FROM alerts
         ${whereClause}
         ORDER BY created_at DESC`,
        params,
      )
      .map((row) => ({
        id: row.id,
        taskId: row.task_id,
        batchId: row.batch_id ?? undefined,
        message: row.message,
        createdAt: row.created_at,
        read: Boolean(row.read),
      }));
  }

  pushAlert(alert: AlertRecord): void {
    this.executor.run(
      `INSERT INTO alerts (id, task_id, batch_id, message, created_at, read)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.taskId,
        alert.batchId ?? null,
        alert.message,
        alert.createdAt,
        alert.read ? 1 : 0,
      ],
    );
  }

  dismissAlert(alertId: string): void {
    this.executor.run('UPDATE alerts SET read = 1 WHERE id = ?', [alertId]);
  }
}
