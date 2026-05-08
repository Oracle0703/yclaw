import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerSigninHandlers } from '@main/ipc/signin-handlers';

describe('registerSigninHandlers', () => {
  it('registers sign-in channels and forwards requests to the corresponding services', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const savePayload = {
      name: '京东签到',
      entryUrl: 'https://interact.jd.com/',
      sessionId: 'session-1',
      enabled: true,
      signin: {
        site: 'jd' as const,
        mode: 'browser-first-api-fallback' as const,
        fallbackApiEnabled: false,
        maxRetryPerDay: 2,
        manualInterventionEnabled: true as const,
      },
    };
    const updatePayload = {
      taskId: 'task-signin-1',
      ...savePayload,
      enabled: false,
    };
    const taskService = {
      createTask: vi.fn((payload) => ({ id: 'task-signin-1', ...payload })),
      updateTaskFlow: vi.fn((taskId, payload) => ({ id: taskId, ...payload })),
      getTaskDetail: vi.fn((taskId) => ({ id: taskId, ...savePayload })),
    };
    const signinTaskService = {
      runTask: vi.fn(async (taskId) => ({ taskId, status: 'success' })),
      markInterventionResolved: vi.fn(async (taskId) => ({ taskId, status: 'success' })),
      getLatestRun: vi.fn((taskId) => ({ taskId, status: 'success' })),
      getRunHistory: vi.fn((taskId) => ([{ taskId, status: 'success' }])),
    };
    const notificationService = {
      sendTestEmail: vi.fn(async () => ({ delivered: true })),
    };
    const logService = {
      info: vi.fn(),
      error: vi.fn(),
    };

    registerSigninHandlers({
      ipcController,
      taskService,
      signinTaskService,
      notificationService,
      logService,
    });

    const channels = [
      IPC_CHANNELS.SIGNIN_TASK_SAVE,
      IPC_CHANNELS.SIGNIN_TASK_GET,
      IPC_CHANNELS.SIGNIN_TASK_RUN_NOW,
      IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY,
      IPC_CHANNELS.SIGNIN_TASK_STATUS,
      IPC_CHANNELS.SIGNIN_TASK_HISTORY,
      IPC_CHANNELS.SIGNIN_NOTIFICATION_TEST_EMAIL,
    ];

    channels.forEach((channel) => {
      expect(ipcController.handle).toHaveBeenCalledWith(channel, expect.any(Function));
      expect(handlers.get(channel)).toBeTypeOf('function');
    });

    expect(await handlers.get(IPC_CHANNELS.SIGNIN_TASK_SAVE)?.(savePayload)).toMatchObject({
      id: 'task-signin-1',
      name: '京东签到',
    });
    expect(taskService.createTask).toHaveBeenCalledWith(savePayload);
    expect(logService.info).toHaveBeenCalledWith(
      'main',
      'signin task save requested',
      expect.objectContaining({
        taskId: null,
        name: '京东签到',
        hasLoginSnapshot: false,
      }),
    );
    expect(logService.info).toHaveBeenCalledWith(
      'main',
      'signin task save succeeded',
      expect.objectContaining({
        taskId: null,
        created: true,
        name: '京东签到',
        savedTaskId: 'task-signin-1',
      }),
    );

    expect(await handlers.get(IPC_CHANNELS.SIGNIN_TASK_SAVE)?.(updatePayload)).toMatchObject({
      id: 'task-signin-1',
      enabled: false,
    });
    expect(taskService.updateTaskFlow).toHaveBeenCalledWith('task-signin-1', {
      ...savePayload,
      enabled: false,
    });
    expect(logService.info).toHaveBeenCalledWith(
      'main',
      'signin task save succeeded',
      expect.objectContaining({
        taskId: 'task-signin-1',
        created: false,
        enabled: false,
      }),
    );

    expect(await handlers.get(IPC_CHANNELS.SIGNIN_TASK_GET)?.({ taskId: 'task-signin-1' })).toMatchObject({
      id: 'task-signin-1',
    });
    expect(taskService.getTaskDetail).toHaveBeenCalledWith('task-signin-1');

    expect(await handlers.get(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW)?.({ taskId: 'task-signin-1' })).toEqual({
      taskId: 'task-signin-1',
      status: 'success',
    });
    expect(signinTaskService.runTask).toHaveBeenCalledWith('task-signin-1');

    expect(
      await handlers.get(IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY)?.({ taskId: 'task-signin-1' }),
    ).toEqual({
      taskId: 'task-signin-1',
      status: 'success',
    });
    expect(signinTaskService.markInterventionResolved).toHaveBeenCalledWith('task-signin-1');

    expect(await handlers.get(IPC_CHANNELS.SIGNIN_TASK_STATUS)?.({ taskId: 'task-signin-1' })).toEqual({
      taskId: 'task-signin-1',
      status: 'success',
    });
    expect(signinTaskService.getLatestRun).toHaveBeenCalledWith('task-signin-1');

    expect(await handlers.get(IPC_CHANNELS.SIGNIN_TASK_HISTORY)?.({ taskId: 'task-signin-1' })).toEqual([
      {
        taskId: 'task-signin-1',
        status: 'success',
      },
    ]);
    expect(signinTaskService.getRunHistory).toHaveBeenCalledWith('task-signin-1');

    expect(await handlers.get(IPC_CHANNELS.SIGNIN_NOTIFICATION_TEST_EMAIL)?.({})).toEqual({
      delivered: true,
    });
    expect(notificationService.sendTestEmail).toHaveBeenCalledTimes(1);
  });
});
