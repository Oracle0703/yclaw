import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SigninTaskService } from '@main/services/signin/SigninTaskService';
import type { TaskFlow } from '@shared/types';

describe('SigninTaskService', () => {
  const getTaskDetail = vi.fn();
  const listSessions = vi.fn();
  const runProvider = vi.fn();
  const scheduleRetry = vi.fn();
  const notify = vi.fn();
  const saveRun = vi.fn();
  const getPersistedLatestRun = vi.fn();
  const listPersistedRuns = vi.fn();

  const signinTask: TaskFlow = {
    id: 'task-signin-1',
    name: '阿里云盘签到',
    kind: 'aliyundrive-signin',
    steps: [],
    entryUrl: 'https://www.aliyundrive.com/',
    sessionId: 'session-1',
    signin: {
      site: 'aliyundrive',
      mode: 'api-first-browser-fallback',
      fallbackApiEnabled: true,
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
      manualInterventionEnabled: true,
    },
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getTaskDetail.mockReturnValue(signinTask);
    listSessions.mockReturnValue([
      {
        id: 'session-1',
        name: '阿里云盘默认账号',
        domain: 'aliyundrive.com',
        partition: 'persist:session_1',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      },
    ]);
  });

  it('runs a sign-in task with resolved session partition and stores the latest summary', async () => {
    runProvider.mockResolvedValueOnce({
      status: 'success',
      strategyUsed: 'browser',
      detail: '今日奖励已领取',
    });

    const service = new SigninTaskService({
      taskService: { getTaskDetail },
      sessionRegistry: { listSessions },
      provider: { run: runProvider },
      scheduler: { scheduleRetry },
      notificationService: { notify },
      runRepository: {
        saveRun,
        getLatestRun: getPersistedLatestRun,
        listRuns: listPersistedRuns,
      },
    });

    const result = await service.runTask('task-signin-1');

    expect(runProvider).toHaveBeenCalledWith({
      taskId: 'task-signin-1',
      sessionPartition: 'persist:session_1',
      entryUrl: 'https://www.aliyundrive.com/',
      refreshToken: 'rt-demo',
      browserFallbackEnabled: true,
      maxRetryPerDay: 2,
    });
    expect(result).toMatchObject({
      taskId: 'task-signin-1',
      status: 'success',
      strategyUsed: 'browser',
      retryCount: 0,
    });
    expect(service.getLatestRun('task-signin-1')).toMatchObject({
      status: 'success',
    });
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-signin-1',
        status: 'success',
      }),
    );
  });

  it('notifies and stores intervention state when provider requests manual handling', async () => {
    runProvider.mockResolvedValueOnce({
      status: 'needs_intervention',
      failureReason: 'session_expired',
      detail: '请重新登录',
    });

    const service = new SigninTaskService({
      taskService: { getTaskDetail },
      sessionRegistry: { listSessions },
      provider: { run: runProvider },
      scheduler: { scheduleRetry },
      notificationService: { notify },
      runRepository: {
        saveRun,
        getLatestRun: getPersistedLatestRun,
        listRuns: listPersistedRuns,
      },
    });

    const result = await service.runTask('task-signin-1');

    expect(result).toMatchObject({
      status: 'needs_intervention',
      failureReason: 'session_expired',
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-signin-1',
        status: 'needs_intervention',
      }),
    );
  });

  it('schedules retry when provider returns retry_scheduled', async () => {
    runProvider.mockResolvedValueOnce({
      status: 'retry_scheduled',
      failureReason: 'api_request_failed',
      detail: '稍后重试',
    });

    const service = new SigninTaskService({
      taskService: { getTaskDetail },
      sessionRegistry: { listSessions },
      provider: { run: runProvider },
      scheduler: { scheduleRetry },
      notificationService: { notify },
      runRepository: {
        saveRun,
        getLatestRun: getPersistedLatestRun,
        listRuns: listPersistedRuns,
      },
    });

    const result = await service.runTask('task-signin-1');

    expect(result.status).toBe('retry_scheduled');
    expect(scheduleRetry).toHaveBeenCalledWith('task-signin-1', expect.any(Number));
  });

  it('preserves debug context in latest run summary', async () => {
    runProvider.mockResolvedValueOnce({
      status: 'needs_intervention',
      failureReason: 'reward_button_not_found',
      detail: '页面未找到领取按钮',
      debug: {
        pageUrl: 'https://www.aliyundrive.com/drive',
        pageTitle: '阿里云盘',
        domSummary: '精选活动 4月28日',
        screenshotDataUrl: 'data:image/png;base64,task-debug',
      },
    });

    const service = new SigninTaskService({
      taskService: { getTaskDetail },
      sessionRegistry: { listSessions },
      provider: { run: runProvider },
      scheduler: { scheduleRetry },
      notificationService: { notify },
      runRepository: {
        saveRun,
        getLatestRun: getPersistedLatestRun,
        listRuns: listPersistedRuns,
      },
    });

    const result = await service.runTask('task-signin-1');

    expect(result).toMatchObject({
      status: 'needs_intervention',
      debug: {
        pageUrl: 'https://www.aliyundrive.com/drive',
        pageTitle: '阿里云盘',
        domSummary: '精选活动 4月28日',
        screenshotDataUrl: 'data:image/png;base64,task-debug',
      },
    });
    expect(service.getLatestRun('task-signin-1')).toMatchObject({
      debug: {
        pageUrl: 'https://www.aliyundrive.com/drive',
        pageTitle: '阿里云盘',
        domSummary: '精选活动 4月28日',
        screenshotDataUrl: 'data:image/png;base64,task-debug',
      },
    });
  });

  it('falls back to persisted latest run when memory cache is empty', () => {
    getPersistedLatestRun.mockReturnValueOnce({
      taskId: 'task-signin-1',
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: '从数据库恢复',
      runAt: '2026-04-28T10:00:00.000Z',
      retryCount: 1,
    });

    const service = new SigninTaskService({
      taskService: { getTaskDetail },
      sessionRegistry: { listSessions },
      provider: { run: runProvider },
      scheduler: { scheduleRetry },
      notificationService: { notify },
      runRepository: {
        saveRun,
        getLatestRun: getPersistedLatestRun,
        listRuns: listPersistedRuns,
      },
    });

    expect(service.getLatestRun('task-signin-1')).toMatchObject({
      status: 'success',
      detail: '从数据库恢复',
    });
    expect(getPersistedLatestRun).toHaveBeenCalledWith('task-signin-1');
  });

  it('reads persisted run history through repository', () => {
    listPersistedRuns.mockReturnValueOnce([
      {
        taskId: 'task-signin-1',
        status: 'success',
        strategyUsed: 'browser',
        runAt: '2026-04-28T10:00:00.000Z',
        retryCount: 0,
      },
    ]);

    const service = new SigninTaskService({
      taskService: { getTaskDetail },
      sessionRegistry: { listSessions },
      provider: { run: runProvider },
      scheduler: { scheduleRetry },
      notificationService: { notify },
      runRepository: {
        saveRun,
        getLatestRun: getPersistedLatestRun,
        listRuns: listPersistedRuns,
      },
    });

    expect(service.getRunHistory('task-signin-1', 5)).toEqual([
      expect.objectContaining({
        taskId: 'task-signin-1',
        status: 'success',
      }),
    ]);
    expect(listPersistedRuns).toHaveBeenCalledWith('task-signin-1', 5);
  });
});
