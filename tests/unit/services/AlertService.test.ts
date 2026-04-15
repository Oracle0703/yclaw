import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  run: vi.fn(),
  all: vi.fn(),
};

const mockExecutionLogService = {
  query: vi.fn(),
};

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDb),
  },
}));

import { AlertService } from '@main/services/AlertService';

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AlertService({
      databaseService: mockDb,
      executionLogService: mockExecutionLogService,
    });
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
    mockDb.all.mockReturnValueOnce([]);

    const alerts = service.aggregateFromExecutionLogs(10);

    expect(alerts).toHaveLength(2);
    expect(alerts[0].message).toContain('2');
    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  it('does not return read alerts in unread list', () => {
    mockDb.all.mockReturnValueOnce([
      {
        id: 'alert-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        message: '任务失败',
        created_at: '2026-04-15T00:00:00.000Z',
        read: 0,
      },
      {
        id: 'alert-2',
        task_id: 'task-2',
        batch_id: 'batch-2',
        message: '任务失败',
        created_at: '2026-04-15T00:01:00.000Z',
        read: 1,
      },
    ]);

    const alerts = service.listAlerts({ unreadOnly: true });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].read).toBe(false);
  });
});
