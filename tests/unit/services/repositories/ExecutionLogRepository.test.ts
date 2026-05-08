import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionLogRepository } from '@main/services/repositories/ExecutionLogRepository';

function createExecutor() {
  return {
    run: vi.fn(),
    all: vi.fn(),
  };
}

describe('ExecutionLogRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: ExecutionLogRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new ExecutionLogRepository(executor);
  });

  it('appends execution logs with serialized metadata', () => {
    repository.append({
      taskId: 'task-1',
      batchId: 'batch-1',
      stepIndex: 0,
      level: 'warn',
      message: 'step slow',
      metadata: { duration: 999 },
      createdAt: '2026-04-17T00:00:00.000Z',
    });

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO execution_logs'),
      ['task-1', 'batch-1', 0, 'warn', 'step slow', JSON.stringify({ duration: 999 }), '2026-04-17T00:00:00.000Z'],
    );
  });

  it('builds filtered queries and parses metadata payloads', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 1,
        task_id: 'task-1',
        batch_id: 'batch-1',
        step_index: null,
        level: 'error',
        message: 'step failed',
        metadata: JSON.stringify({ screenshot: 'shot.png' }),
        created_at: '2026-04-17T00:00:00.000Z',
      },
    ]);

    expect(
      repository.query({
        taskId: 'task-1',
        batchId: 'batch-1',
        level: 'error',
        since: '2026-04-17T00:00:00.000Z',
      }),
    ).toEqual([
      {
        id: 1,
        taskId: 'task-1',
        batchId: 'batch-1',
        stepIndex: undefined,
        level: 'error',
        message: 'step failed',
        metadata: { screenshot: 'shot.png' },
        createdAt: '2026-04-17T00:00:00.000Z',
      },
    ]);

    const [sql, params] = executor.all.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE');
    expect(params).toEqual(['task-1', 'batch-1', 'error', '2026-04-17T00:00:00.000Z']);
  });
});
