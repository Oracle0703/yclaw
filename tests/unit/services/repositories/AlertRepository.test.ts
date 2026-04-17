import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlertRecord } from '@shared/types';
import { AlertRepository } from '@main/services/repositories/AlertRepository';

function createExecutor() {
  return {
    all: vi.fn(),
    run: vi.fn(),
  };
}

describe('AlertRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: AlertRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new AlertRepository(executor);
  });

  it('lists alerts with unread filter mapping database rows', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'alert-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        message: '任务失败',
        created_at: '2026-04-17T00:00:00.000Z',
        read: 0,
      },
    ]);

    expect(repository.listAlerts({ unreadOnly: true })).toEqual([
      {
        id: 'alert-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        message: '任务失败',
        createdAt: '2026-04-17T00:00:00.000Z',
        read: false,
      },
    ]);
    expect(executor.all).toHaveBeenCalledWith(expect.stringContaining('read = 0'), []);
  });

  it('persists and dismisses alerts', () => {
    const alert: AlertRecord = {
      id: 'alert-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      message: '任务失败',
      createdAt: '2026-04-17T00:00:00.000Z',
      read: false,
    };

    repository.pushAlert(alert);
    repository.dismissAlert('alert-1');

    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO alerts'),
      ['alert-1', 'task-1', 'batch-1', '任务失败', '2026-04-17T00:00:00.000Z', 0],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      2,
      'UPDATE alerts SET read = 1 WHERE id = ?',
      ['alert-1'],
    );
  });
});
