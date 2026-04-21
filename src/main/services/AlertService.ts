import { randomUUID } from 'crypto';
import type { AlertActionRecord, AlertRecord, WorkspaceDutyPolicy } from '@shared/types';
import type { ExecutionLogService } from './ExecutionLogService';
import { AlertRepository } from './repositories';

export interface AlertQuery {
  unreadOnly?: boolean;
  taskId?: string;
}

interface AlertActionInput {
  alertId: string;
  action: string;
  operator?: string;
  note?: string;
  createdAt: string;
}

export interface AlertServiceOptions {
  executionLogService?: Pick<ExecutionLogService, 'query'>;
  alertRepository?: Pick<
    AlertRepository,
    'listAlerts' | 'pushAlert' | 'dismissAlert' | 'updateAlert' | 'addAction' | 'listActions'
  >;
  dutyPolicyProvider?: {
    resolveDutyPolicy(workspaceId: string): WorkspaceDutyPolicy;
  };
}

export class AlertService {
  private readonly alertRepository: Pick<
    AlertRepository,
    'listAlerts' | 'pushAlert' | 'dismissAlert' | 'updateAlert' | 'addAction' | 'listActions'
  >;
  private readonly executionLogService: Pick<ExecutionLogService, 'query'>;
  private readonly dutyPolicyProvider?: NonNullable<AlertServiceOptions['dutyPolicyProvider']>;

  constructor(options: AlertServiceOptions = {}) {
    if (!options.alertRepository) {
      throw new Error('alertRepository is required');
    }

    if (!options.executionLogService) {
      throw new Error('executionLogService is required');
    }

    this.alertRepository = options.alertRepository;
    this.executionLogService = options.executionLogService;
    this.dutyPolicyProvider = options.dutyPolicyProvider;
  }

  listAlerts(query: AlertQuery = {}): AlertRecord[] {
    return this.alertRepository.listAlerts(query);
  }

  pushAlert(
    alert: Omit<AlertRecord, 'id' | 'createdAt' | 'read'> & Partial<AlertRecord>,
  ): AlertRecord {
    const dutyPolicy = alert.workspaceId
      ? this.dutyPolicyProvider?.resolveDutyPolicy(alert.workspaceId)
      : null;
    const record: AlertRecord = {
      id: alert.id ?? randomUUID(),
      workspaceId: alert.workspaceId,
      taskId: alert.taskId,
      batchId: alert.batchId,
      message: alert.message,
      createdAt: alert.createdAt ?? new Date().toISOString(),
      read: alert.read ?? false,
      status: alert.status ?? 'new',
      assignee: alert.assignee ?? dutyPolicy?.currentOperator?.name ?? null,
      level: alert.level ?? 'warning',
      resolution: alert.resolution,
    };

    this.alertRepository.pushAlert(record);

    return record;
  }

  dismissAlert(alertId: string): void {
    this.alertRepository.dismissAlert(alertId);
  }

  claimAlert(alertId: string, assignee: string) {
    const updated = this.alertRepository.updateAlert(alertId, {
      status: 'claimed',
      assignee,
    });

    this.alertRepository.addAction({
      alertId,
      action: 'claim',
      operator: assignee,
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  assignAlert(alertId: string, assignee: string, operator: string, note?: string) {
    const updated = this.alertRepository.updateAlert(alertId, {
      status: 'claimed',
      assignee,
    });

    this.alertRepository.addAction({
      alertId,
      action: 'assign',
      operator,
      note,
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  addAlertNote(alertId: string, operator: string, note: string): void {
    this.alertRepository.addAction({
      alertId,
      action: 'note',
      operator,
      note,
      createdAt: new Date().toISOString(),
    });
  }

  listAlertActions(alertId: string): AlertActionRecord[] {
    return this.alertRepository.listActions(alertId);
  }

  autoEscalateAlerts(): AlertRecord[] {
    const alerts = this.listAlerts();
    const escalated: AlertRecord[] = [];

    for (const alert of alerts) {
      if (
        !alert.workspaceId
        || alert.read
        || !alert.status
        || !['new', 'claimed', 'processing'].includes(alert.status)
      ) {
        continue;
      }

      const dutyPolicy = this.dutyPolicyProvider?.resolveDutyPolicy(alert.workspaceId);
      const limitMinutes = dutyPolicy?.alertAutoEscalateMinutes;
      if (!limitMinutes || limitMinutes <= 0) {
        continue;
      }

      const overdueMs = Date.now() - new Date(alert.createdAt).getTime();
      if (overdueMs < limitMinutes * 60 * 1000) {
        continue;
      }

      const updated = this.escalateAlert(
        alert.id,
        dutyPolicy?.escalationOwner?.name,
        '告警超时未处理，已自动升级',
        alert.workspaceId,
      );

      if (updated) {
        escalated.push(updated);
      }
    }

    return escalated;
  }

  escalateAlert(alertId: string, operator?: string, note?: string, workspaceId?: string) {
    const dutyPolicy = workspaceId
      ? this.dutyPolicyProvider?.resolveDutyPolicy(workspaceId)
      : null;
    const escalationOperator = operator ?? dutyPolicy?.escalationOwner?.name ?? 'current-operator';
    const updated = this.alertRepository.updateAlert(alertId, {
      status: 'escalated',
      assignee: dutyPolicy?.escalationOwner?.name,
    });

    this.alertRepository.addAction({
      alertId,
      action: 'escalate',
      operator: escalationOperator,
      note,
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  closeAlert(alertId: string, resolution: string, operator: string) {
    const updated = this.alertRepository.updateAlert(alertId, {
      status: 'closed',
      resolution,
      read: true,
    });

    this.alertRepository.addAction({
      alertId,
      action: 'close',
      operator,
      note: resolution,
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  aggregateFromExecutionLogs(minutes = 10): AlertRecord[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const unreadAlerts = this.listAlerts({ unreadOnly: true });
    const existingTaskIds = new Set(unreadAlerts.map((alert) => alert.taskId));
    const errorLogs = this.executionLogService.query({ level: 'error', since: cutoff });

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
