import type { AlertActionRecord, AlertRecord } from '@shared/types';
import type { AlertQuery } from '../AlertService';

interface AlertRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface AlertRow {
  id: string;
  workspace_id?: string | null;
  task_id: string;
  batch_id?: string | null;
  message: string;
  created_at: string;
  read: number;
  status?: string | null;
  assignee?: string | null;
  level?: string | null;
  resolution?: string | null;
}

interface AlertActionInput {
  alertId: string;
  action: string;
  operator?: string;
  note?: string;
  createdAt: string;
}

interface AlertActionRow {
  id: string;
  alert_id: string;
  action: string;
  operator?: string | null;
  note?: string | null;
  created_at: string;
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
        `SELECT id, workspace_id, task_id, batch_id, message, created_at, read, status, assignee, level, resolution
         FROM alerts
         ${whereClause}
         ORDER BY created_at DESC`,
        params,
      )
      .map(mapAlertRow);
  }

  pushAlert(alert: AlertRecord): void {
    if (
      alert.status !== undefined
      || alert.assignee !== undefined
      || alert.level !== undefined
      || alert.resolution !== undefined
    ) {
      this.executor.run(
        `INSERT INTO alerts (
          id, workspace_id, task_id, batch_id, message, created_at, read, status, assignee, level, resolution, updated_at
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alert.id,
          alert.workspaceId ?? null,
          alert.taskId,
          alert.batchId ?? null,
          alert.message,
          alert.createdAt,
          alert.read ? 1 : 0,
          alert.status ?? 'new',
          alert.assignee ?? null,
          alert.level ?? 'warning',
          alert.resolution ?? null,
          alert.createdAt,
        ],
      );
      return;
    }

    this.executor.run(
      `INSERT INTO alerts (id, workspace_id, task_id, batch_id, message, created_at, read)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.workspaceId ?? null,
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

  updateAlert(
    alertId: string,
    updates: Partial<Pick<AlertRecord, 'read' | 'status' | 'assignee' | 'level' | 'resolution'>>,
  ): AlertRecord | null {
    const assignments: string[] = [];
    const params: unknown[] = [];

    if (updates.read !== undefined) {
      assignments.push('read = ?');
      params.push(updates.read ? 1 : 0);
    }
    if (updates.status !== undefined) {
      assignments.push('status = ?');
      params.push(updates.status);
    }
    if (updates.assignee !== undefined) {
      assignments.push('assignee = ?');
      params.push(updates.assignee ?? null);
    }
    if (updates.level !== undefined) {
      assignments.push('level = ?');
      params.push(updates.level);
    }
    if (updates.resolution !== undefined) {
      assignments.push('resolution = ?');
      params.push(updates.resolution ?? null);
    }

    if (assignments.length === 0) {
      return this.getAlert(alertId);
    }

    params.push(alertId);
    this.executor.run(
      `UPDATE alerts
       SET ${assignments.join(', ')}, updated_at = datetime('now')
       WHERE id = ?`,
      params,
    );

    return this.getAlert(alertId);
  }

  addAction(action: AlertActionInput): void {
    this.executor.run(
      `INSERT INTO alert_actions (id, alert_id, action, operator, note, created_at)
       VALUES (hex(randomblob(16)), ?, ?, ?, ?, ?)`,
      [
        action.alertId,
        action.action,
        action.operator ?? null,
        action.note ?? null,
        action.createdAt,
      ],
    );
  }

  listActions(alertId: string): AlertActionRecord[] {
    return this.executor
      .all<AlertActionRow>(
        `SELECT id, alert_id, action, operator, note, created_at
         FROM alert_actions
         WHERE alert_id = ?
         ORDER BY created_at DESC`,
        [alertId],
      )
      .map(mapAlertActionRow);
  }

  private getAlert(alertId: string): AlertRecord | null {
    const row = this.executor.all<AlertRow>(
      `SELECT id, workspace_id, task_id, batch_id, message, created_at, read, status, assignee, level, resolution
       FROM alerts
       WHERE id = ?
       LIMIT 1`,
      [alertId],
    )[0];

    return row ? mapAlertRow(row) : null;
  }
}

function mapAlertActionRow(row: AlertActionRow): AlertActionRecord {
  return {
    id: row.id,
    alertId: row.alert_id,
    action: row.action as AlertActionRecord['action'],
    operator: row.operator ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function mapAlertRow(row: AlertRow): AlertRecord {
  const alert: AlertRecord = {
    id: row.id,
    workspaceId: row.workspace_id ?? undefined,
    taskId: row.task_id,
    batchId: row.batch_id ?? undefined,
    message: row.message,
    createdAt: row.created_at,
    read: Boolean(row.read),
  };

  if (row.status != null) {
    alert.status = row.status as AlertRecord['status'];
  }
  if (row.assignee != null) {
    alert.assignee = row.assignee;
  }
  if (row.level != null) {
    alert.level = row.level as AlertRecord['level'];
  }
  if (row.resolution != null) {
    alert.resolution = row.resolution;
  }

  return alert;
}
