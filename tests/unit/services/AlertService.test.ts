import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAlertRepository = {
  listAlerts: vi.fn(),
  pushAlert: vi.fn(),
  dismissAlert: vi.fn(),
  updateAlert: vi.fn(),
  addAction: vi.fn(),
  listActions: vi.fn(),
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
    vi.useRealTimers();
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

  it('assigns new workspace alerts to the current duty operator', () => {
    const dutyAwareService = new AlertService({
      alertRepository: mockAlertRepository,
      executionLogService: mockExecutionLogService,
      dutyPolicyProvider: {
        resolveDutyPolicy: vi.fn(() => ({
          workspaceId: 'workspace-1',
          currentOperator: {
            id: 'member-2',
            name: 'Operator B',
          },
          escalationOwner: {
            id: 'member-1',
            name: 'Owner A',
          },
          alertAutoEscalateMinutes: 10,
        })),
      },
    } as never);
    mockAlertRepository.pushAlert.mockImplementationOnce((alert) => alert);

    const alert = dutyAwareService.pushAlert({
      workspaceId: 'workspace-1',
      taskId: 'task-1',
      message: '任务失败',
      level: 'critical',
    });

    expect(alert.assignee).toBe('Operator B');
    expect(alert.status).toBe('new');
    expect(mockAlertRepository.pushAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        assignee: 'Operator B',
        level: 'critical',
        status: 'new',
      }),
    );
  });

  it('escalates alert to workspace owner when operator is omitted', () => {
    const dutyAwareService = new AlertService({
      alertRepository: mockAlertRepository,
      executionLogService: mockExecutionLogService,
      dutyPolicyProvider: {
        resolveDutyPolicy: vi.fn(() => ({
          workspaceId: 'workspace-1',
          currentOperator: {
            id: 'member-2',
            name: 'Operator B',
          },
          escalationOwner: {
            id: 'member-1',
            name: 'Owner A',
          },
          alertAutoEscalateMinutes: 10,
        })),
      },
    } as never);
    mockAlertRepository.updateAlert.mockReturnValueOnce({
      id: 'alert-1',
      workspaceId: 'workspace-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      message: '任务失败',
      createdAt: '2026-04-21T00:00:00.000Z',
      read: false,
      status: 'escalated',
      assignee: 'Owner A',
    });

    const escalated = dutyAwareService.escalateAlert('alert-1', undefined, undefined, 'workspace-1');

    expect(escalated?.assignee).toBe('Owner A');
    expect(mockAlertRepository.updateAlert).toHaveBeenCalledWith('alert-1', {
      status: 'escalated',
      assignee: 'Owner A',
    });
    expect(mockAlertRepository.addAction).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'alert-1',
        action: 'escalate',
        operator: 'Owner A',
      }),
    );
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

  it('claims and escalates alert with action history', () => {
    mockAlertRepository.updateAlert.mockReturnValueOnce({
      id: 'alert-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      message: '任务失败',
      createdAt: '2026-04-21T00:00:00.000Z',
      read: false,
      status: 'claimed',
      assignee: 'operator-a',
    });

    const alert = service.claimAlert('alert-1', 'operator-a');

    expect(alert.assignee).toBe('operator-a');
    expect(mockAlertRepository.addAction).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'alert-1',
        action: 'claim',
      }),
    );
  });

  it('escalates and closes alert with operator resolution', () => {
    mockAlertRepository.updateAlert
      .mockReturnValueOnce({
        id: 'alert-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        message: '任务失败',
        createdAt: '2026-04-21T00:00:00.000Z',
        read: false,
        status: 'escalated',
      })
      .mockReturnValueOnce({
        id: 'alert-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        message: '任务失败',
        createdAt: '2026-04-21T00:00:00.000Z',
        read: true,
        status: 'closed',
        resolution: '已补充模板修复',
      });

    const escalated = service.escalateAlert('alert-1', 'owner-a', '高优先级处理');
    const closed = service.closeAlert('alert-1', '已补充模板修复', 'owner-a');

    expect(escalated.status).toBe('escalated');
    expect(closed.status).toBe('closed');
    expect(closed.resolution).toBe('已补充模板修复');
    expect(mockAlertRepository.addAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        alertId: 'alert-1',
        action: 'escalate',
        operator: 'owner-a',
        note: '高优先级处理',
      }),
    );
    expect(mockAlertRepository.addAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        alertId: 'alert-1',
        action: 'close',
        operator: 'owner-a',
        note: '已补充模板修复',
      }),
    );
  });

  it('assigns alert and appends operator note', () => {
    mockAlertRepository.updateAlert.mockReturnValueOnce({
      id: 'alert-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      message: '任务失败',
      createdAt: '2026-04-21T00:00:00.000Z',
      read: false,
      status: 'claimed',
      assignee: 'operator-b',
    });

    const assigned = service.assignAlert('alert-1', 'operator-b', 'owner-a', '转交给值班员');
    service.addAlertNote('alert-1', 'operator-b', '已检查日志，准备修复模板');

    expect(assigned.assignee).toBe('operator-b');
    expect(mockAlertRepository.addAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        alertId: 'alert-1',
        action: 'assign',
        operator: 'owner-a',
        note: '转交给值班员',
      }),
    );
    expect(mockAlertRepository.addAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        alertId: 'alert-1',
        action: 'note',
        operator: 'operator-b',
        note: '已检查日志，准备修复模板',
      }),
    );
  });

  it('lists action history for an alert', () => {
    mockAlertRepository.listActions.mockReturnValueOnce([
      {
        id: 'action-1',
        alertId: 'alert-1',
        action: 'note',
        operator: 'operator-b',
        note: '已检查日志',
        createdAt: '2026-04-21T08:05:00.000Z',
      },
    ]);

    expect(service.listAlertActions('alert-1')).toEqual([
      {
        id: 'action-1',
        alertId: 'alert-1',
        action: 'note',
        operator: 'operator-b',
        note: '已检查日志',
        createdAt: '2026-04-21T08:05:00.000Z',
      },
    ]);
    expect(mockAlertRepository.listActions).toHaveBeenCalledWith('alert-1');
  });

  it('auto escalates overdue alerts based on workspace duty policy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T10:30:00.000Z'));
    const dutyAwareService = new AlertService({
      alertRepository: mockAlertRepository,
      executionLogService: mockExecutionLogService,
      dutyPolicyProvider: {
        resolveDutyPolicy: vi.fn(() => ({
          workspaceId: 'workspace-1',
          currentOperator: {
            id: 'member-2',
            name: 'Operator B',
          },
          escalationOwner: {
            id: 'member-1',
            name: 'Owner A',
          },
          alertAutoEscalateMinutes: 10,
        })),
      },
    } as never);
    mockAlertRepository.listAlerts.mockReturnValueOnce([
      {
        id: 'alert-1',
        workspaceId: 'workspace-1',
        taskId: 'task-1',
        message: '任务失败',
        createdAt: '2026-04-21T10:00:00.000Z',
        read: false,
        status: 'new',
      },
      {
        id: 'alert-2',
        workspaceId: 'workspace-1',
        taskId: 'task-2',
        message: '任务处理中',
        createdAt: '2026-04-21T10:25:00.000Z',
        read: false,
        status: 'claimed',
      },
      {
        id: 'alert-3',
        workspaceId: 'workspace-1',
        taskId: 'task-3',
        message: '任务已关闭',
        createdAt: '2026-04-21T10:00:00.000Z',
        read: true,
        status: 'closed',
      },
    ]);
    mockAlertRepository.updateAlert.mockReturnValueOnce({
      id: 'alert-1',
      workspaceId: 'workspace-1',
      taskId: 'task-1',
      message: '任务失败',
      createdAt: '2026-04-21T10:00:00.000Z',
      read: false,
      status: 'escalated',
      assignee: 'Owner A',
    });

    const escalated = dutyAwareService.autoEscalateAlerts();

    expect(escalated).toEqual([
      expect.objectContaining({
        id: 'alert-1',
        status: 'escalated',
        assignee: 'Owner A',
      }),
    ]);
    expect(mockAlertRepository.updateAlert).toHaveBeenCalledTimes(1);
    expect(mockAlertRepository.addAction).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'alert-1',
        action: 'escalate',
        operator: 'Owner A',
        note: '告警超时未处理，已自动升级',
      }),
    );
  });
});
