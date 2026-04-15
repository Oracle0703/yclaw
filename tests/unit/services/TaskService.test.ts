import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskFlow } from '@shared/types';

const mockDb = {
  getTasks: vi.fn(),
  getTaskFlow: vi.fn(),
  saveTaskFlow: vi.fn(),
  updateTaskStatus: vi.fn(),
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

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDb),
  },
}));

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
    mockDb.getTasks.mockReturnValue([
      {
        id: 'task-1',
        name: '采集任务',
        status: 'idle',
        updatedAt: '2026-04-15 10:00:00',
      },
    ]);
    mockDb.getTaskFlow.mockReturnValue(sampleFlow);
    mockRunner.getStatus.mockReturnValue('running');
    service = new TaskService({
      createRunner: () => mockRunner as never,
    });
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
    expect(mockDb.getTaskFlow).toHaveBeenCalledWith('task-1');
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

    expect(mockDb.saveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        steps: nextSteps,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'task-1',
        steps: nextSteps,
      }),
    );
  });

  it('saves updated task name with edited steps', () => {
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

    expect(mockDb.saveTaskFlow).toHaveBeenCalledWith(
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

    expect(mockDb.saveTaskFlow).toHaveBeenCalledWith(
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

    expect(mockDb.saveTaskFlow).toHaveBeenCalledWith(
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

  it('starts a task with persisted flow and active webContents', async () => {
    mockRunner.run.mockResolvedValueOnce({ success: true, stepResults: [] });

    const result = await service.startTask('task-1', webContents);

    expect(mockDb.getTaskFlow).toHaveBeenCalledWith('task-1');
    expect(mockRunner.run).toHaveBeenCalledWith(sampleFlow, webContents, 0);
    expect(result).toEqual({ taskId: 'task-1', status: 'running' });
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
});
