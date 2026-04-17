import { beforeEach, describe, expect, it, vi } from 'vitest';

const makeTask = (id: string, enabled = true, schedule = { type: 'cron' as const, cron: '*/5 * * * *' }) => ({
  id,
  name: `task-${id}`,
  status: 'idle',
  updatedAt: '2026-04-15T00:00:00.000Z',
  enabled,
  schedule,
});

import { SchedulerService } from '@main/services/SchedulerService';

describe('SchedulerService', () => {
  const mockTaskService = {
    listTasks: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires task service injection', () => {
    expect(() => new SchedulerService()).toThrowError('taskService is required');
  });

  it('registers enabled cron tasks on start', () => {
    mockTaskService.listTasks.mockReturnValue([
      makeTask('task-1'),
      makeTask('task-2', false),
      makeTask('task-3', true, { type: 'manual' as const }),
    ]);

    const service = new SchedulerService({
      taskService: mockTaskService as never,
    });

    service.start();

    expect(mockTaskService.listTasks).toHaveBeenCalled();
    expect(service.getScheduledTaskIds()).toEqual(['task-1']);
  });

  it('queues tasks when max concurrency is reached', async () => {
    let releaseFirst: (() => void) | undefined;
    const executeTask = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);

    const service = new SchedulerService({
      taskService: mockTaskService as never,
      executeTask,
      maxConcurrency: 1,
    });

    await service.triggerTask('task-1');
    await service.triggerTask('task-2');

    expect(service.getStatus()).toMatchObject({
      runningCount: 1,
      queuedCount: 1,
    });

    releaseFirst?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(executeTask).toHaveBeenCalledTimes(2);
  });

  it('re-registers schedules after restart', () => {
    mockTaskService.listTasks.mockReturnValue([makeTask('task-1'), makeTask('task-2')]);

    const first = new SchedulerService({
      taskService: mockTaskService as never,
    });
    first.start();
    first.stop();

    const second = new SchedulerService({
      taskService: mockTaskService as never,
    });
    second.start();

    expect(mockTaskService.listTasks).toHaveBeenCalledTimes(2);
    expect(second.getScheduledTaskIds()).toEqual(['task-1', 'task-2']);
  });
});
