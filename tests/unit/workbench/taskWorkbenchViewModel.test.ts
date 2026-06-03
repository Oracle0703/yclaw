import { describe, expect, it } from 'vitest';
import type { ExtractionResult, SigninRunSummary } from '@shared/types';
import type { TaskSummary } from '@main/services/TaskService';
import { buildTaskWorkbenchViewModel } from '@renderer/entries/workbench/task-toolbench/taskWorkbenchViewModel';
import { listTaskTemplates } from '@renderer/entries/workbench/task-toolbench/templates';

const templates = listTaskTemplates();

function task(overrides: Partial<TaskSummary> & { id: string; name: string }): TaskSummary {
  return {
    status: 'idle',
    updatedAt: '2026-06-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('task workbench view model', () => {
  it('returns a create-task empty state without fake data when there are no tasks', () => {
    const model = buildTaskWorkbenchViewModel({
      tasks: [],
      signinStatuses: {},
      standardResults: [],
      signinHistories: {},
      templates,
    });

    expect(model.emptyState).toEqual({
      title: '还没有任务',
      description: '从京东签到模板开始创建第一个本地任务。',
      primaryAction: 'from-template',
    });
    expect(model.runningItems).toEqual([]);
    expect(model.failedItems).toEqual([]);
    expect(model.recentResults).toEqual([]);
  });

  it('uses sign-in status for a JD task even when the task has no standard batch', () => {
    const latestSignin: SigninRunSummary = {
      taskId: 'task-jd',
      status: 'needs_intervention',
      failureReason: 'session_expired',
      detail: '登录态失效',
      runAt: '2026-06-01T10:00:00.000Z',
      retryCount: 0,
    };

    const model = buildTaskWorkbenchViewModel({
      tasks: [
        task({
          id: 'task-jd',
          name: '京东签到',
          status: 'idle',
          updatedAt: '2026-06-01T09:00:00.000Z',
        }),
      ],
      signinStatuses: {
        'task-jd': latestSignin,
      },
      standardResults: [],
      signinHistories: {
        'task-jd': [latestSignin],
      },
      templates,
    });

    expect(model.failedItems).toEqual([
      expect.objectContaining({
        id: 'signin:task-jd:2026-06-01T10:00:00.000Z',
        sourceType: 'signin',
        taskId: 'task-jd',
        statusLabel: '需人工介入',
        navigateTo: '/runs?taskId=task-jd',
      }),
    ]);
    expect(model.failedItems[0]?.rawStatus).toBe('needs_intervention');
  });

  it('keeps standard and signin results together without fabricating batch ids', () => {
    const standardResult: ExtractionResult = {
      id: 'result-1',
      taskId: 'task-generic',
      batchId: 'batch-1',
      data: { title: '标准结果' },
      status: 'normal',
      createdAt: '2026-06-01T08:00:00.000Z',
    };
    const signinRun: SigninRunSummary = {
      taskId: 'task-jd',
      status: 'success',
      reward: { detailText: '获得 10 京豆' },
      runAt: '2026-06-01T09:00:00.000Z',
      retryCount: 0,
    };

    const model = buildTaskWorkbenchViewModel({
      tasks: [task({ id: 'task-generic', name: '网页采集' }), task({ id: 'task-jd', name: '京东签到' })],
      signinStatuses: {
        'task-jd': signinRun,
      },
      standardResults: [standardResult],
      signinHistories: {
        'task-jd': [signinRun],
      },
      templates,
    });

    expect(model.recentResults).toEqual([
      expect.objectContaining({
        id: 'signin:task-jd:2026-06-01T09:00:00.000Z',
        sourceType: 'signin',
        batchId: null,
      }),
      expect.objectContaining({
        id: 'result-1',
        sourceType: 'standard',
        batchId: 'batch-1',
      }),
    ]);
  });
});
