import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SigninRunRepository } from '@main/services/repositories/SigninRunRepository';

function createExecutor() {
  return {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
  };
}

describe('SigninRunRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: SigninRunRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new SigninRunRepository(executor);
  });

  it('saves latest run summary with debug payload serialized', () => {
    repository.saveRun({
      taskId: 'task-signin-1',
      status: 'needs_intervention',
      strategyUsed: 'api-fallback',
      failureReason: 'activity_not_found',
      detail: '页面未找到签到区域',
      debug: {
        pageUrl: 'https://interact.jd.com/',
        pageTitle: '京东',
        domSummary: 'PC签到领京豆 4月28日',
        screenshotDataUrl: 'data:image/png;base64,repo-debug',
      },
      reward: {
        earnedBeans: 2,
        balance: 2,
        balanceStr: '0.02',
        detailText: '活动奖励京豆',
      },
      runAt: '2026-04-28T09:00:00.000Z',
      retryCount: 1,
    });

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO signin_task_runs'),
      [
        'task-signin-1',
        'needs_intervention',
        'api-fallback',
        'activity_not_found',
        '页面未找到签到区域',
        JSON.stringify({
          pageUrl: 'https://interact.jd.com/',
          pageTitle: '京东',
          domSummary: 'PC签到领京豆 4月28日',
          screenshotDataUrl: 'data:image/png;base64,repo-debug',
        }),
        JSON.stringify({
          earnedBeans: 2,
          balance: 2,
          balanceStr: '0.02',
          detailText: '活动奖励京豆',
        }),
        '2026-04-28T09:00:00.000Z',
        1,
      ],
    );
  });

  it('reads latest run and run history with parsed debug snapshot', () => {
    executor.get.mockReturnValueOnce({
      task_id: 'task-signin-1',
      status: 'success',
      strategy_used: 'manual-retry',
      failure_reason: null,
      detail: '人工处理后签到成功',
      debug_json: null,
      reward_json: JSON.stringify({
        earnedBeans: 2,
        balance: 2,
        balanceStr: '0.02',
      }),
      run_at: '2026-04-28T09:05:00.000Z',
      retry_count: 2,
    });
    executor.all.mockReturnValueOnce([
      {
        task_id: 'task-signin-1',
        status: 'success',
        strategy_used: 'manual-retry',
        failure_reason: null,
        detail: '人工处理后签到成功',
        debug_json: null,
        reward_json: JSON.stringify({
          earnedBeans: 2,
          balance: 2,
          balanceStr: '0.02',
        }),
        run_at: '2026-04-28T09:05:00.000Z',
        retry_count: 2,
      },
      {
        task_id: 'task-signin-1',
        status: 'needs_intervention',
        strategy_used: 'api-fallback',
        failure_reason: 'activity_not_found',
        detail: '页面未找到签到区域',
        debug_json: JSON.stringify({
          pageUrl: 'https://interact.jd.com/',
          pageTitle: '京东',
          domSummary: 'PC签到领京豆 4月28日',
          screenshotDataUrl: 'data:image/png;base64,repo-debug',
        }),
        reward_json: null,
        run_at: '2026-04-28T09:00:00.000Z',
        retry_count: 1,
      },
    ]);

    expect(repository.getLatestRun('task-signin-1')).toEqual({
      taskId: 'task-signin-1',
      status: 'success',
      strategyUsed: 'manual-retry',
      failureReason: undefined,
      detail: '人工处理后签到成功',
      debug: undefined,
      reward: {
        earnedBeans: 2,
        balance: 2,
        balanceStr: '0.02',
      },
      runAt: '2026-04-28T09:05:00.000Z',
      retryCount: 2,
    });

    expect(repository.listRuns('task-signin-1', 10)).toEqual([
      {
        taskId: 'task-signin-1',
        status: 'success',
        strategyUsed: 'manual-retry',
        failureReason: undefined,
        detail: '人工处理后签到成功',
        debug: undefined,
        reward: {
          earnedBeans: 2,
          balance: 2,
          balanceStr: '0.02',
        },
        runAt: '2026-04-28T09:05:00.000Z',
        retryCount: 2,
      },
      {
        taskId: 'task-signin-1',
        status: 'needs_intervention',
        strategyUsed: 'api-fallback',
        failureReason: 'activity_not_found',
        detail: '页面未找到签到区域',
        debug: {
          pageUrl: 'https://interact.jd.com/',
          pageTitle: '京东',
          domSummary: 'PC签到领京豆 4月28日',
          screenshotDataUrl: 'data:image/png;base64,repo-debug',
        },
        reward: undefined,
        runAt: '2026-04-28T09:00:00.000Z',
        retryCount: 1,
      },
    ]);
    expect(executor.all).toHaveBeenCalledWith(
      expect.stringContaining('FROM signin_task_runs'),
      ['task-signin-1', 10],
    );
  });
});
