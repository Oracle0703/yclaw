import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StepResult, TaskBatch, TaskBreakpoint } from '@shared/types';
import { BatchRepository } from '@main/services/repositories/BatchRepository';

function createExecutor() {
  return {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
  };
}

describe('BatchRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: BatchRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new BatchRepository(executor);
  });

  it('inserts a batch with retry metadata stored in breakpoint_json', () => {
    const batch: TaskBatch = {
      id: 'batch-1',
      taskId: 'task-1',
      status: 'pending',
      createdAt: '2026-04-17T00:00:00.000Z',
      stepResults: [],
    };

    repository.insertBatch(batch, {
      reason: 'retry',
      sourceBatchId: 'batch-0',
    });

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO task_batches'),
      [
        'batch-1',
        'task-1',
        'pending',
        '[]',
        null,
        JSON.stringify({ reason: 'retry', sourceBatchId: 'batch-0' }),
        '2026-04-17T00:00:00.000Z',
      ],
    );
  });

  it('updates batch state transitions and serializes step results or breakpoint', () => {
    const stepResults: StepResult[] = [{ stepId: 'step-1', success: true, duration: 1 }];
    const breakpoint: TaskBreakpoint = { stepIndex: 1, error: 'missing selector' };

    repository.startBatch('batch-1', '2026-04-17T01:00:00.000Z');
    repository.finishBatch('batch-1', stepResults, '2026-04-17T02:00:00.000Z');
    repository.failBatch('batch-1', 'failed', breakpoint, '2026-04-17T03:00:00.000Z');

    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE task_batches SET status = ?'),
      ['running', '2026-04-17T01:00:00.000Z', 'batch-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('step_results = ?'),
      ['success', '2026-04-17T02:00:00.000Z', JSON.stringify(stepResults), 'batch-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('breakpoint_json = ?'),
      ['failed', '2026-04-17T03:00:00.000Z', 'failed', JSON.stringify(breakpoint), 'batch-1'],
    );
  });

  it('maps persisted batch rows into domain objects', () => {
    executor.get.mockReturnValueOnce({
      id: 'batch-1',
      task_id: 'task-1',
      status: 'failed',
      started_at: '2026-04-17T01:00:00.000Z',
      finished_at: '2026-04-17T02:00:00.000Z',
      step_results: JSON.stringify([{ stepId: 'step-1', success: false, duration: 1 }]),
      error: 'failed',
      breakpoint_json: JSON.stringify({ stepIndex: 1, error: 'missing selector' }),
      created_at: '2026-04-17T00:00:00.000Z',
    });
    executor.all.mockReturnValueOnce([
      {
        id: 'batch-1',
        task_id: 'task-1',
        status: 'success',
        started_at: null,
        finished_at: null,
        step_results: '[]',
        error: null,
        breakpoint_json: null,
        created_at: '2026-04-17T00:00:00.000Z',
      },
    ]);

    expect(repository.getBatch('batch-1')).toEqual({
      id: 'batch-1',
      taskId: 'task-1',
      status: 'failed',
      startedAt: '2026-04-17T01:00:00.000Z',
      finishedAt: '2026-04-17T02:00:00.000Z',
      stepResults: [{ stepId: 'step-1', success: false, duration: 1 }],
      error: 'failed',
      breakpoint: { stepIndex: 1, error: 'missing selector' },
      createdAt: '2026-04-17T00:00:00.000Z',
    });

    expect(repository.listBatchesByTask('task-1')).toEqual([
      {
        id: 'batch-1',
        taskId: 'task-1',
        status: 'success',
        startedAt: null,
        finishedAt: null,
        stepResults: [],
        error: null,
        breakpoint: null,
        createdAt: '2026-04-17T00:00:00.000Z',
      },
    ]);
  });
});
