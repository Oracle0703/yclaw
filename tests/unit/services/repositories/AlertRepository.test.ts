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
        workspace_id: 'workspace-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        message: '任务失败',
        created_at: '2026-04-17T00:00:00.000Z',
        read: 0,
        status: 'new',
        assignee: 'Operator B',
        level: 'critical',
      },
    ]);

    expect(repository.listAlerts({ unreadOnly: true })).toEqual([
      {
        id: 'alert-1',
        workspaceId: 'workspace-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        message: '任务失败',
        createdAt: '2026-04-17T00:00:00.000Z',
        read: false,
        status: 'new',
        assignee: 'Operator B',
        level: 'critical',
      },
    ]);
    expect(executor.all).toHaveBeenCalledWith(expect.stringContaining('read = 0'), []);
  });

  it('persists and dismisses alerts', () => {
    const alert: AlertRecord = {
      id: 'alert-1',
      workspaceId: 'workspace-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      message: '任务失败',
      createdAt: '2026-04-17T00:00:00.000Z',
      read: false,
      status: 'new',
      assignee: 'Operator B',
      level: 'warning',
    };

    repository.pushAlert(alert);
    repository.dismissAlert('alert-1');

    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO alerts'),
      [
        'alert-1',
        'workspace-1',
        'task-1',
        'batch-1',
        '任务失败',
        '2026-04-17T00:00:00.000Z',
        0,
        'new',
        'Operator B',
        'warning',
        null,
        '2026-04-17T00:00:00.000Z',
      ],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      2,
      'UPDATE alerts SET read = 1 WHERE id = ?',
      ['alert-1'],
    );
  });

  it('lists alert action history by newest first', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'action-2',
        alert_id: 'alert-1',
        action: 'note',
        operator: 'operator-b',
        note: '已检查日志',
        created_at: '2026-04-21T08:05:00.000Z',
      },
      {
        id: 'action-1',
        alert_id: 'alert-1',
        action: 'assign',
        operator: 'owner-a',
        note: '转交给值班员',
        created_at: '2026-04-21T08:00:00.000Z',
      },
    ]);

    expect(repository.listActions('alert-1')).toEqual([
      {
        id: 'action-2',
        alertId: 'alert-1',
        action: 'note',
        operator: 'operator-b',
        note: '已检查日志',
        createdAt: '2026-04-21T08:05:00.000Z',
      },
      {
        id: 'action-1',
        alertId: 'alert-1',
        action: 'assign',
        operator: 'owner-a',
        note: '转交给值班员',
        createdAt: '2026-04-21T08:00:00.000Z',
      },
    ]);
    expect(executor.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE alert_id = ?'),
      ['alert-1'],
    );
  });
});
