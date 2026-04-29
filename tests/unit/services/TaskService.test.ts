import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskFlow } from '@shared/types';
import type { TaskBatch } from '@shared/types';

const mockTaskRepository = {
  getTasks: vi.fn(),
  getTaskFlow: vi.fn(),
  saveTaskFlow: vi.fn(),
  updateTaskStatus: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
};

const mockBatchService = {
  createBatch: vi.fn(),
  startBatch: vi.fn(),
  finishBatch: vi.fn(),
  failBatch: vi.fn(),
  getBatch: vi.fn(),
  listBatchesByTask: vi.fn(),
};

const mockEventBus = {
  emit: vi.fn(),
};

const mockRunner = {
  run: vi.fn(),
  pause: vi.fn(),
  unpause: vi.fn(),
  abort: vi.fn(),
  getStatus: vi.fn(),
  getBreakpoint: vi.fn(),
  resume: vi.fn(),
};

import { TaskService } from '@main/services/TaskService';

const sampleFlow: TaskFlow = {
  id: 'task-1',
  name: '采集任务',
  steps: [
    {
      id: 'step-1',
      name: '点击按钮',
      action: {
        type: 'click',
        selector: '#submit',
      },
    },
  ],
  createdAt: '2026-04-15T00:00:00.000Z',
  updatedAt: '2026-04-15T00:00:00.000Z',
};

describe('TaskService', () => {
  let service: TaskService;
  const webContents = { id: 101 } as unknown as Electron.WebContents;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskRepository.getTasks.mockReturnValue([
      {
        id: 'task-1',
        name: '采集任务',
        status: 'idle',
        updatedAt: '2026-04-15 10:00:00',
      },
    ]);
    mockTaskRepository.getTaskFlow.mockReturnValue(sampleFlow);
    mockRunner.getStatus.mockReturnValue('running');
    mockBatchService.createBatch.mockReturnValue({
      id: 'batch-created',
      taskId: 'task-1',
      status: 'pending',
      createdAt: '2026-04-15T10:00:00.000Z',
      stepResults: [],
    } satisfies TaskBatch);
    service = new TaskService({
      taskRepository: mockTaskRepository as never,
      createRunner: () => mockRunner as never,
      eventBus: mockEventBus as never,
      batchService: mockBatchService as never,
    });
  });

  it('requires task repository injection', () => {
    expect(() => new TaskService({ batchService: mockBatchService as never })).toThrowError(
      'taskRepository is required',
    );
  });

  it('requires batch service injection', () => {
    expect(() => new TaskService({ taskRepository: mockTaskRepository as never })).toThrowError(
      'batchService is required',
    );
  });

  it('requires event bus injection', () => {
    expect(
      () =>
        new TaskService({
          taskRepository: mockTaskRepository as never,
          batchService: mockBatchService as never,
        }),
    ).toThrowError('eventBus is required');
  });

  it('requires runner factory injection', () => {
    expect(
      () =>
        new TaskService({
          taskRepository: mockTaskRepository as never,
          eventBus: mockEventBus as never,
          batchService: mockBatchService as never,
        }),
    ).toThrowError('createRunner is required');
  });

  it('lists persisted tasks from database', () => {
    expect(service.listTasks()).toEqual([
      {
        id: 'task-1',
        name: '采集任务',
        status: 'idle',
        updatedAt: '2026-04-15 10:00:00',
      },
    ]);
  });

  it('returns persisted task flow details by id', () => {
    expect(service.getTaskFlow('task-1')).toEqual(sampleFlow);
    expect(mockTaskRepository.getTaskFlow).toHaveBeenCalledWith('task-1');
  });

  it('saves updated task steps back to persistence', () => {
    const nextSteps = [
      ...sampleFlow.steps,
      {
        id: 'step-2',
        name: '采集价格',
        action: {
          type: 'extract' as const,
          selector: '.price',
        },
      },
    ];

    const result = service.saveTaskSteps('task-1', nextSteps);

    expect(mockTaskRepository.saveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        name: '采集任务',
        steps: nextSteps,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'task-1',
        name: '采集任务',
        steps: nextSteps,
      }),
    );
  });

  it('preserves existing task name when saving steps via saveTaskSteps', () => {
    const nextSteps = [
      {
        id: 'step-new',
        name: '新步骤',
        action: { type: 'click' as const, selector: '#new' },
      },
    ];

    service.saveTaskSteps('task-1', nextSteps);

    expect(mockTaskRepository.saveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        name: '采集任务',
      }),
    );
  });

  it('saves updated task name with edited steps when name is explicitly provided', () => {
    const nextSteps = [
      ...sampleFlow.steps,
      {
        id: 'step-2',
        name: '采集价格',
        action: {
          type: 'extract' as const,
          selector: '.price',
        },
      },
    ];

    const result = service.saveTaskFlow('task-1', {
      name: '  价格采集任务  ',
      steps: nextSteps,
    });

    expect(mockTaskRepository.saveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        name: '价格采集任务',
        steps: nextSteps,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'task-1',
        name: '价格采集任务',
        steps: nextSteps,
      }),
    );
  });

  it('falls back to default task name when creating a task with blank name', () => {
    const result = service.saveTaskFlow(null, {
      name: '   ',
      steps: [
        {
          id: 'step-new-1',
          name: '打开首页',
          action: {
            type: 'click' as const,
            selector: '#home',
          },
        },
      ],
    });

    expect(mockTaskRepository.saveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: '未命名任务',
      }),
    );
    expect(result.name).toBe('未命名任务');
  });

  it('creates a new task flow when saving without task id', () => {
    const newSteps = [
      {
        id: 'step-new-1',
        name: '打开首页',
        action: {
          type: 'click' as const,
          selector: '#home',
        },
      },
    ];

    const result = service.saveTaskSteps(null, newSteps);

    expect(mockTaskRepository.saveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: '未命名任务',
        steps: newSteps,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: '未命名任务',
        steps: newSteps,
      }),
    );
  });

  it('starts a task with persisted flow and active page', async () => {
    mockRunner.run.mockResolvedValueOnce({ success: true, stepResults: [] });

    const result = await service.startTask('task-1', webContents);

    expect(mockTaskRepository.getTaskFlow).toHaveBeenCalledWith('task-1');
    expect(mockRunner.run).toHaveBeenCalledWith(sampleFlow, webContents, 0, 'batch-created');
    expect(result).toEqual({ taskId: 'task-1', status: 'running' });
  });

  it('records batch lifecycle when a task run succeeds', async () => {
    const stepResults = [{ stepId: 'step-1', success: true, duration: 10 }];
    mockRunner.run.mockResolvedValueOnce({ success: true, stepResults });
    mockBatchService.createBatch.mockReturnValueOnce({
      id: 'batch-run-1',
      taskId: 'task-1',
      status: 'pending',
      createdAt: '2026-04-20T00:00:00.000Z',
      stepResults: [],
    } satisfies TaskBatch);

    service.startTask('task-1', webContents);
    await Promise.resolve();

    expect(mockBatchService.createBatch).toHaveBeenCalledWith('task-1', { reason: 'manual' });
    expect(mockBatchService.startBatch).toHaveBeenCalledWith('batch-run-1');
    expect(mockBatchService.finishBatch).toHaveBeenCalledWith('batch-run-1', stepResults);
  });

  it('records failed batch details when a task run fails', async () => {
    mockRunner.run.mockResolvedValueOnce({
      success: false,
      stepResults: [],
      error: 'selector missing',
      breakpoint: { stepIndex: 0, error: 'selector missing' },
    });
    mockBatchService.createBatch.mockReturnValueOnce({
      id: 'batch-run-2',
      taskId: 'task-1',
      status: 'pending',
      createdAt: '2026-04-20T00:00:00.000Z',
      stepResults: [],
    } satisfies TaskBatch);

    service.startTask('task-1', webContents);
    await Promise.resolve();

    expect(mockBatchService.failBatch).toHaveBeenCalledWith(
      'batch-run-2',
      'selector missing',
      { stepIndex: 0, error: 'selector missing' },
    );
  });

  it('pauses a running task', () => {
    service.attachTask('task-1', sampleFlow, mockRunner as never);

    const result = service.pauseTask('task-1');

    expect(mockRunner.pause).toHaveBeenCalled();
    expect(result).toEqual({ taskId: 'task-1', status: 'paused' });
  });

  it('resumes a paused task without losing runner state', async () => {
    mockRunner.getStatus.mockReturnValue('paused');
    service.attachTask('task-1', sampleFlow, mockRunner as never);

    const result = await service.resumeTask('task-1', webContents);

    expect(mockRunner.unpause).toHaveBeenCalled();
    expect(result).toEqual({ taskId: 'task-1', status: 'running' });
  });

  it('stops an active task', () => {
    service.attachTask('task-1', sampleFlow, mockRunner as never);

    const result = service.stopTask('task-1');

    expect(mockRunner.abort).toHaveBeenCalled();
    expect(result).toEqual({ taskId: 'task-1', status: 'idle' });
  });

  it('stores schedule and batch metadata on task records', () => {
    mockTaskRepository.getTasks.mockReturnValueOnce([
      {
        id: 'task-1',
        name: '采集任务',
        status: 'idle',
        updatedAt: '2026-04-15 10:00:00',
        schedule: {
          type: 'cron',
          cron: '0 * * * *',
        },
        nextRunAt: '2026-04-15T11:00:00.000Z',
        lastRunAt: '2026-04-15T10:00:00.000Z',
        latestBatch: {
          id: 'batch-1',
          taskId: 'task-1',
          status: 'running',
          createdAt: '2026-04-15T10:00:00.000Z',
          stepResults: [],
        },
      },
    ]);

    const [task] = service.listTasks();

    expect(task).toMatchObject({
      schedule: { type: 'cron', cron: '0 * * * *' },
      nextRunAt: '2026-04-15T11:00:00.000Z',
      lastRunAt: '2026-04-15T10:00:00.000Z',
      latestBatch: {
        id: 'batch-1',
        status: 'running',
      },
    });
  });

  it('creates a new batch when retrying a failed batch', async () => {
    mockBatchService.getBatch.mockReturnValueOnce({
      id: 'batch-failed',
      taskId: 'task-1',
      status: 'failed',
      createdAt: '2026-04-15T09:00:00.000Z',
      stepResults: [],
      error: 'selector not found',
    } satisfies TaskBatch);

    const retried = await service.retryBatch('batch-failed');

    expect(mockBatchService.getBatch).toHaveBeenCalledWith('batch-failed');
    expect(mockBatchService.createBatch).toHaveBeenCalledWith('task-1', {
      sourceBatchId: 'batch-failed',
      reason: 'retry',
    });
    expect(retried).toEqual({
      id: 'batch-created',
      taskId: 'task-1',
      status: 'pending',
      createdAt: '2026-04-15T10:00:00.000Z',
      stepResults: [],
    });
  });

  it('creates a sign-in task with kind and signin config', () => {
    service.createTask({
      name: '阿里云盘签到',
      entryUrl: 'https://www.aliyundrive.com/',
      sessionId: 'session-1',
      enabled: true,
      signin: {
        site: 'aliyundrive',
        mode: 'browser-first-api-fallback',
        fallbackApiEnabled: true,
        refreshToken: 'rt-demo',
        accessToken: 'at-demo',
        userName: '测试账号',
        userId: 'uid-demo',
        defaultDriveId: 'drive-demo',
        expiresAt: '2026-05-01T00:00:00.000Z',
        tokenType: 'Bearer',
        tokenPayload: {
          refresh_token: 'rt-demo',
          access_token: 'at-demo',
        },
        localStorageSnapshot: {
          token: '{"refresh_token":"rt-demo"}',
          shareToken: 'share-demo',
        },
        maxRetryPerDay: 2,
        manualInterventionEnabled: true,
      },
    } as Parameters<TaskService['createTask']>[0] & {
      signin: {
        site: 'aliyundrive';
        mode: 'browser-first-api-fallback';
        fallbackApiEnabled: boolean;
        refreshToken: string;
        accessToken: string;
        userName: string;
        userId: string;
        defaultDriveId: string;
        expiresAt: string;
        tokenType: string;
        tokenPayload: Record<string, unknown>;
        localStorageSnapshot: Record<string, string>;
        maxRetryPerDay: number;
        manualInterventionEnabled: true;
      };
    });

    expect(mockTaskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        flowJson: JSON.stringify({
          steps: [],
          entryUrl: 'https://www.aliyundrive.com/',
          kind: 'aliyundrive-signin',
          signin: {
            site: 'aliyundrive',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: true,
            refreshToken: 'rt-demo',
            accessToken: 'at-demo',
            userName: '测试账号',
            userId: 'uid-demo',
            defaultDriveId: 'drive-demo',
            expiresAt: '2026-05-01T00:00:00.000Z',
            tokenType: 'Bearer',
            tokenPayload: {
              refresh_token: 'rt-demo',
              access_token: 'at-demo',
            },
            localStorageSnapshot: {
              token: '{"refresh_token":"rt-demo"}',
              shareToken: 'share-demo',
            },
            maxRetryPerDay: 2,
            manualInterventionEnabled: true,
          },
        }),
      }),
    );
  });

  it('falls back to default task name when creating a sign-in task with blank name', () => {
    service.createTask({
      name: '   ',
      entryUrl: 'https://www.aliyundrive.com/',
      sessionId: 'session-1',
      enabled: true,
      signin: {
        site: 'aliyundrive',
        mode: 'api-first-browser-fallback',
        fallbackApiEnabled: true,
        refreshToken: null,
        maxRetryPerDay: 1,
        manualInterventionEnabled: true,
      },
    });

    expect(mockTaskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '未命名任务',
      }),
    );
  });

  it('preserves sign-in metadata when saving task flow updates', () => {
    const signinFlow = {
      ...sampleFlow,
      kind: 'aliyundrive-signin',
      signin: {
        site: 'aliyundrive',
        mode: 'browser-first-api-fallback',
        fallbackApiEnabled: true,
        refreshToken: 'rt-demo',
        accessToken: 'at-demo',
        userName: '测试账号',
        userId: 'uid-demo',
        defaultDriveId: 'drive-demo',
        expiresAt: '2026-05-01T00:00:00.000Z',
        tokenType: 'Bearer',
        tokenPayload: {
          refresh_token: 'rt-demo',
          access_token: 'at-demo',
        },
        localStorageSnapshot: {
          token: '{"refresh_token":"rt-demo"}',
          shareToken: 'share-demo',
        },
        maxRetryPerDay: 2,
        manualInterventionEnabled: true,
      },
    } as TaskFlow & {
      kind: 'aliyundrive-signin';
      signin: {
        site: 'aliyundrive';
        mode: 'browser-first-api-fallback';
        fallbackApiEnabled: boolean;
        refreshToken: string;
        accessToken: string;
        userName: string;
        userId: string;
        defaultDriveId: string;
        expiresAt: string;
        tokenType: string;
        tokenPayload: Record<string, unknown>;
        localStorageSnapshot: Record<string, string>;
        maxRetryPerDay: number;
        manualInterventionEnabled: true;
      };
    };
    mockTaskRepository.getTaskFlow.mockReturnValueOnce(signinFlow);

    service.saveTaskFlow('task-1', {
      name: '阿里云盘签到',
      steps: signinFlow.steps,
    });

    expect(mockTaskRepository.saveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'aliyundrive-signin',
        signin: expect.objectContaining({
          site: 'aliyundrive',
          refreshToken: 'rt-demo',
        }),
      }),
    );
  });

  it('does not include name in repository update payload when updating sign-in metadata without name', () => {
    const signinFlow = {
      ...sampleFlow,
      kind: 'aliyundrive-signin',
      entryUrl: 'https://www.aliyundrive.com/',
      signin: {
        site: 'aliyundrive',
        mode: 'api-first-browser-fallback',
        fallbackApiEnabled: true,
        refreshToken: null,
        maxRetryPerDay: 1,
        manualInterventionEnabled: true,
      },
    } as TaskFlow & {
      kind: 'aliyundrive-signin';
      signin: {
        site: 'aliyundrive';
        mode: 'api-first-browser-fallback';
        fallbackApiEnabled: boolean;
        refreshToken: string | null;
        maxRetryPerDay: number;
        manualInterventionEnabled: true;
      };
    };
    mockTaskRepository.getTaskFlow.mockReturnValueOnce(signinFlow);
    mockTaskRepository.getTaskFlow.mockReturnValueOnce({
      ...signinFlow,
      signin: {
        ...signinFlow.signin,
        refreshToken: 'rt-captured',
      },
    });

    service.updateTaskFlow('task-1', {
      entryUrl: 'https://www.aliyundrive.com/',
      signin: {
        ...signinFlow.signin,
        refreshToken: 'rt-captured',
      },
    });

    expect(mockTaskRepository.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.not.objectContaining({
        name: undefined,
      }),
    );
    expect(mockTaskRepository.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        flowJson: expect.any(String),
      }),
    );
  });
});
