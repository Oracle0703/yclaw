import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAlertRepository = {
  listAlerts: vi.fn(),
  pushAlert: vi.fn(),
  dismissAlert: vi.fn(),
};

const mockExecutionLogService = {
  query: vi.fn(),
};

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      run: vi.fn(),
      all: vi.fn(),
    })),
  },
}));

import { AlertService } from '@main/services/AlertService';

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AlertService({
      alertRepository: mockAlertRepository,
      executionLogService: mockExecutionLogService,
    } as never);
  });

  it('requires alert repository injection', () => {
    expect(() => new AlertService()).toThrowError('alertRepository is required');
  });

  it('requires execution log service injection', () => {
    expect(
      () =>
        new AlertService({
          alertRepository: mockAlertRepository,
        } as never),
    ).toThrowError('executionLogService is required');
  });

  it('aggregates multiple recent error logs by task id', () => {
    const now = new Date().toISOString();
    mockExecutionLogService.query.mockReturnValueOnce([
      {
        taskId: 'task-1',
        batchId: 'batch-1',
        level: 'error',
        message: 'login expired',
        createdAt: now,
      },
      {
        taskId: 'task-1',
        batchId: 'batch-2',
        level: 'error',
        message: 'selector missing',
        createdAt: now,
      },
      {
        taskId: 'task-2',
        batchId: 'batch-3',
        level: 'error',
        message: 'network timeout',
        createdAt: now,
      },
    ]);
    mockAlertRepository.listAlerts.mockReturnValueOnce([]);
    mockAlertRepository.pushAlert.mockImplementation((alert) => ({
      id: `alert-${alert.taskId}`,
      createdAt: now,
      read: false,
      ...alert,
    }));

    const alerts = service.aggregateFromExecutionLogs(10);

    expect(alerts).toHaveLength(2);
    expect(alerts[0].message).toContain('2');
    expect(mockAlertRepository.pushAlert).toHaveBeenCalledTimes(2);
  });

  it('does not return read alerts in unread list', () => {
    mockAlertRepository.listAlerts.mockReturnValueOnce([
      {
        id: 'alert-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        message: '任务失败',
        createdAt: '2026-04-15T00:00:00.000Z',
        read: false,
      },
    ]);

    const alerts = service.listAlerts({ unreadOnly: true });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].read).toBe(false);
    expect(mockAlertRepository.listAlerts).toHaveBeenCalledWith({ unreadOnly: true });
  });
});
