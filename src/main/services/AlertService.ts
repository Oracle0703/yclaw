import { randomUUID } from 'crypto';
import type { AlertRecord } from '@shared/types';
import type { ExecutionLogService } from './ExecutionLogService';
import { AlertRepository } from './repositories';

export interface AlertQuery {
  unreadOnly?: boolean;
  taskId?: string;
}

export interface AlertServiceOptions {
  executionLogService?: Pick<ExecutionLogService, 'query'>;
  alertRepository?: Pick<AlertRepository, 'listAlerts' | 'pushAlert' | 'dismissAlert'>;
}

export class AlertService {
  private readonly alertRepository: Pick<AlertRepository, 'listAlerts' | 'pushAlert' | 'dismissAlert'>;
  private readonly executionLogService: Pick<ExecutionLogService, 'query'>;

  constructor(options: AlertServiceOptions = {}) {
    if (!options.alertRepository) {
      throw new Error('alertRepository is required');
    }

    if (!options.executionLogService) {
      throw new Error('executionLogService is required');
    }

    this.alertRepository = options.alertRepository;
    this.executionLogService = options.executionLogService;
  }

  listAlerts(query: AlertQuery = {}): AlertRecord[] {
    return this.alertRepository.listAlerts(query);
  }

  pushAlert(
    alert: Omit<AlertRecord, 'id' | 'createdAt' | 'read'> & Partial<AlertRecord>,
  ): AlertRecord {
    const record: AlertRecord = {
      id: alert.id ?? randomUUID(),
      taskId: alert.taskId,
      batchId: alert.batchId,
      message: alert.message,
      createdAt: alert.createdAt ?? new Date().toISOString(),
      read: alert.read ?? false,
    };

    this.alertRepository.pushAlert(record);

    return record;
  }

  dismissAlert(alertId: string): void {
    this.alertRepository.dismissAlert(alertId);
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
