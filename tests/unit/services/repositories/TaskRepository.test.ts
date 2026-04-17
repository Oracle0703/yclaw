import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskFlow } from '@shared/types';
import { TaskRepository } from '@main/services/repositories/TaskRepository';

function createExecutor() {
  return {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn()),
  };
}

describe('TaskRepository', () => {
  const flow: TaskFlow = {
    id: 'task-1',
    name: '采集任务',
    description: '描述',
    steps: [
      {
        id: 'step-1',
        name: '点击按钮',
        action: { type: 'click', selector: '#submit' },
        retryCount: 3,
        retryDelay: 1000,
      },
    ],
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  };

  let executor: ReturnType<typeof createExecutor>;
  let repository: TaskRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new TaskRepository(executor);
  });

  it('parses task list rows with schedule and latest batch json', () => {
    executor.all.mockReturnValue([
      {
        id: 'task-1',
        name: '采集任务',
        status: 'idle',
        scheduleJson: JSON.stringify({ type: 'cron', cron: '*/5 * * * *' }),
        nextRunAt: '2026-04-17 10:00:00',
        lastRunAt: null,
        updatedAt: '2026-04-17 09:00:00',
        latestBatchJson: JSON.stringify({
          id: 'batch-1',
          taskId: 'task-1',
          status: 'success',
          createdAt: '2026-04-17 09:10:00',
          stepResults: [],
        }),
      },
    ]);

    expect(repository.getTasks()).toEqual([
      {
        id: 'task-1',
        name: '采集任务',
        status: 'idle',
        schedule: { type: 'cron', cron: '*/5 * * * *' },
        nextRunAt: '2026-04-17 10:00:00',
        lastRunAt: null,
        updatedAt: '2026-04-17 09:00:00',
        latestBatch: {
          id: 'batch-1',
          taskId: 'task-1',
          status: 'success',
          createdAt: '2026-04-17 09:10:00',
          stepResults: [],
        },
      },
    ]);
  });

  it('returns null when task flow does not exist', () => {
    executor.get.mockReturnValue(undefined);

    expect(repository.getTaskFlow('missing')).toBeNull();
  });

  it('falls back to task_steps when flow json has no steps', () => {
    executor.get.mockReturnValue({
      id: 'task-1',
      name: '采集任务',
      description: '描述',
      flowJson: JSON.stringify({ steps: [] }),
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    });
    executor.all.mockReturnValue([
      {
        id: 'step-1',
        name: '点击按钮',
        actionJson: JSON.stringify({ type: 'click', selector: '#submit' }),
        retryCount: 3,
        retryDelay: 1000,
      },
    ]);

    expect(repository.getTaskFlow('task-1')).toEqual(flow);
    expect(executor.all).toHaveBeenCalledWith(expect.stringContaining('FROM task_steps'), ['task-1']);
  });

  it('updates task status', () => {
    repository.updateTaskStatus('task-1', 'running');

    expect(executor.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE tasks'), ['running', 'task-1']);
  });

  it('creates task with nullable fields normalized', () => {
    repository.createTask({
      id: 'task-1',
      name: '采集任务',
      flowJson: '{"steps":[]}',
    });

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tasks'),
      ['task-1', '采集任务', null, '{"steps":[]}', null, null, null],
    );
  });

  it('updates task with provided fields only', () => {
    repository.updateTask('task-1', {
      name: '新名称',
      scheduleJson: null,
    });

    const [sql, params] = executor.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('name = ?');
    expect(sql).toContain('schedule_json = ?');
    expect(sql).toContain("updated_at = datetime('now')");
    expect(params).toEqual(['新名称', null, 'task-1']);
  });

  it('skips task update when updates payload is empty', () => {
    repository.updateTask('task-1', {});

    expect(executor.run).not.toHaveBeenCalled();
  });

  it('deletes task by id', () => {
    repository.deleteTask('task-1');

    expect(executor.run).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = ?', ['task-1']);
  });

  it('saves task flow and inserts missing task before rewriting steps', () => {
    executor.run
      .mockReturnValueOnce({ changes: 0 })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 1 });

    repository.saveTaskFlow(flow);

    expect(executor.transaction).toHaveBeenCalledTimes(1);
    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE tasks'),
      ['采集任务', '描述', JSON.stringify({ steps: flow.steps }), 'task-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO tasks'),
      ['task-1', '采集任务', '描述', JSON.stringify({ steps: flow.steps }), flow.createdAt, flow.updatedAt],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM task_steps'),
      ['task-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO task_steps'),
      ['step-1', 'task-1', 0, '点击按钮', JSON.stringify({ type: 'click', selector: '#submit' }), 3, 1000],
    );
  });
});
