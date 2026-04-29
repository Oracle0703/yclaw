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
    entryUrl: 'https://example.com/workspace',
    schedule: { type: 'manual' },
    sessionId: 'session-1',
    templateId: 'template-1',
    enabled: true,
    tags: [],
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
        description: '描述',
        flowJson: JSON.stringify({ entryUrl: 'https://example.com/workspace' }),
        scheduleJson: JSON.stringify({ type: 'cron', cron: '*/5 * * * *' }),
        nextRunAt: '2026-04-17 10:00:00',
        lastRunAt: null,
        currentRevisionId: 'revision-1',
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
        description: '描述',
        entryUrl: 'https://example.com/workspace',
        kind: 'generic',
        signin: null,
        schedule: { type: 'cron', cron: '*/5 * * * *' },
        nextRunAt: '2026-04-17 10:00:00',
        lastRunAt: null,
        currentRevisionId: 'revision-1',
        updatedAt: '2026-04-17 09:00:00',
        enabled: true,
        tags: [],
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
      flowJson: JSON.stringify({ steps: [], entryUrl: flow.entryUrl }),
      scheduleJson: JSON.stringify({ type: 'manual' }),
      sessionId: 'session-1',
      templateId: 'template-1',
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

    expect(repository.getTaskFlow('task-1')).toEqual({
      ...flow,
      kind: 'generic',
      signin: null,
    });
    expect(executor.all).toHaveBeenCalledWith(expect.stringContaining('FROM task_steps'), [
      'task-1',
    ]);
  });

  it('updates task status', () => {
    repository.updateTaskStatus('task-1', 'running');

    expect(executor.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE tasks'), [
      'running',
      'task-1',
    ]);
  });

  it('creates task with nullable fields normalized', () => {
    repository.createTask({
      id: 'task-1',
      name: '采集任务',
      flowJson: '{"steps":[]}',
    });

    expect(executor.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tasks'), [
      'task-1',
      '采集任务',
      null,
      '{"steps":[]}',
      null,
      null,
      null,
      1,
      '[]',
    ]);
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
    expect(executor.run).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE tasks'), [
      '采集任务',
      '描述',
      JSON.stringify({
        steps: flow.steps,
        entryUrl: flow.entryUrl,
        kind: 'generic',
        signin: null,
      }),
      'task-1',
    ]);
    expect(executor.run).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO tasks'), [
      'task-1',
      '采集任务',
      '描述',
      JSON.stringify({
        steps: flow.steps,
        entryUrl: flow.entryUrl,
        kind: 'generic',
        signin: null,
      }),
      JSON.stringify({ type: 'manual' }),
      'session-1',
      'template-1',
      1,
      '[]',
      flow.createdAt,
      flow.updatedAt,
    ]);
    expect(executor.run).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM task_steps'),
      ['task-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO task_steps'),
      [
        'step-1',
        'task-1',
        0,
        '点击按钮',
        JSON.stringify({ type: 'click', selector: '#submit' }),
        3,
        1000,
      ],
    );
  });

  it('persists signin metadata inside flow json and restores it from getTaskFlow', () => {
    const signinFlow = {
      ...flow,
      id: 'task-signin-1',
      name: '阿里云盘签到',
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

    executor.run
      .mockReturnValueOnce({ changes: 0 })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 1 });

    repository.saveTaskFlow(signinFlow);

    expect(executor.run).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE tasks'), [
      '阿里云盘签到',
      '描述',
      JSON.stringify({
        steps: signinFlow.steps,
        entryUrl: signinFlow.entryUrl,
        kind: 'aliyundrive-signin',
        signin: signinFlow.signin,
      }),
      'task-signin-1',
    ]);

    executor.get.mockReturnValueOnce({
      id: 'task-signin-1',
      name: '阿里云盘签到',
      description: '描述',
      flowJson: JSON.stringify({
        steps: signinFlow.steps,
        entryUrl: signinFlow.entryUrl,
        kind: 'aliyundrive-signin',
        signin: signinFlow.signin,
      }),
      scheduleJson: JSON.stringify({ type: 'manual' }),
      sessionId: 'session-1',
      templateId: 'template-1',
      enabled: 1,
      tagsJson: '[]',
      createdAt: signinFlow.createdAt,
      updatedAt: signinFlow.updatedAt,
    });

    expect(repository.getTaskFlow('task-signin-1')).toMatchObject({
      id: 'task-signin-1',
      name: '阿里云盘签到',
      kind: 'aliyundrive-signin',
      signin: {
        site: 'aliyundrive',
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
      },
    });
  });
});
