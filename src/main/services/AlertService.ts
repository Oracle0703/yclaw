import { randomUUID } from 'crypto';
import type { AlertRecord } from '@shared/types';
import type { DatabaseService } from './DatabaseService';
import type { ExecutionLogService } from './ExecutionLogService';
import { DatabaseService as DatabaseServiceSingleton } from './DatabaseService';
import { ExecutionLogService as ExecutionLogServiceSingleton } from './ExecutionLogService';

export interface AlertQuery {
  unreadOnly?: boolean;
  taskId?: string;
}

export interface AlertServiceOptions {
  databaseService?: Pick<DatabaseService, 'run' | 'all'>;
  executionLogService?: Pick<ExecutionLogService, 'query'>;
}

export class AlertService {
  private readonly databaseService: Pick<DatabaseService, 'run' | 'all'>;
  private readonly executionLogService: Pick<ExecutionLogService, 'query'>;

  constructor(options: AlertServiceOptions = {}) {
    this.databaseService = options.databaseService ?? DatabaseServiceSingleton.getInstance();
    this.executionLogService = options.executionLogService ?? new ExecutionLogServiceSingleton();
  }

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
    const rows = this.databaseService.all<{
      id: string;
      task_id: string;
      batch_id?: string | null;
      message: string;
      created_at: string;
      read: number;
    }>(
      `SELECT id, task_id, batch_id, message, created_at, read
       FROM alerts
       ${whereClause}
       ORDER BY created_at DESC`,
      params,
    );

    return rows
      .map((row) => ({
        id: row.id,
        taskId: row.task_id,
        batchId: row.batch_id ?? undefined,
        message: row.message,
        createdAt: row.created_at,
        read: Boolean(row.read),
      }))
      .filter((alert) => !query.unreadOnly || !alert.read);
  }

  pushAlert(alert: Omit<AlertRecord, 'id' | 'createdAt' | 'read'> & Partial<AlertRecord>): AlertRecord {
    const record: AlertRecord = {
      id: alert.id ?? randomUUID(),
      taskId: alert.taskId,
      batchId: alert.batchId,
      message: alert.message,
      createdAt: alert.createdAt ?? new Date().toISOString(),
      read: alert.read ?? false,
    };

    this.databaseService.run(
      `INSERT INTO alerts (id, task_id, batch_id, message, created_at, read)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.taskId,
        record.batchId ?? null,
        record.message,
        record.createdAt,
        record.read ? 1 : 0,
      ],
    );

    return record;
  }

  dismissAlert(alertId: string): void {
    this.databaseService.run('UPDATE alerts SET read = 1 WHERE id = ?', [alertId]);
  }

  aggregateFromExecutionLogs(minutes = 10): AlertRecord[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    const unreadAlerts = this.listAlerts({ unreadOnly: true });
    const existingTaskIds = new Set(unreadAlerts.map((alert) => alert.taskId));
    const errorLogs = this.executionLogService
      .query({ level: 'error' })
      .filter((record) => Date.parse(record.createdAt ?? '') >= cutoff);

    const grouped = new Map<string, { count: number; batchId?: string; latestMessage: string }>();

    for (const log of errorLogs) {
      const current = grouped.get(log.taskId) ?? {
        count: 0,
        batchId: log.batchId,
        latestMessage: log.message,
      };
      current.count += 1;
      current.batchId = log.batchId;
      current.latestMessage = log.message;
      grouped.set(log.taskId, current);
    }

    const created: AlertRecord[] = [];
    for (const [taskId, group] of grouped.entries()) {
      if (existingTaskIds.has(taskId)) {
        continue;
      }

      created.push(
        this.pushAlert({
          taskId,
          batchId: group.batchId,
          message: `最近 ${group.count} 条错误，请优先检查：${group.latestMessage}`,
        }),
      );
    }

    return created;
  }
}
