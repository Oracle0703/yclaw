import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskBreakpoint, StepResult } from '@shared/types';

const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
};

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDb),
  },
}));

import { BatchService } from '@main/services/BatchService';

describe('BatchService', () => {
  let service: BatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BatchService();
  });

  it('creates a pending batch by default', () => {
    mockDb.run.mockReturnValueOnce({ changes: 1 });

    const batch = service.createBatch('task-1');

    expect(mockDb.run).toHaveBeenCalled();
    expect(batch).toMatchObject({
      taskId: 'task-1',
      status: 'pending',
    });
    expect(batch.id).toBeTruthy();
  });

  it('moves a batch into running state when started', () => {
    mockDb.run.mockReturnValueOnce({ changes: 1 });

    service.startBatch('batch-1');

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE task_batches'),
      ['running', expect.any(String), 'batch-1'],
    );
  });

  it('moves a batch into success state when finished', () => {
    const stepResults: StepResult[] = [
      {
        stepId: 'step-1',
        success: true,
        duration: 12,
      },
    ];

    service.finishBatch('batch-1', stepResults);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE task_batches'),
      ['success', expect.any(String), JSON.stringify(stepResults), 'batch-1'],
    );
  });

  it('stores error and breakpoint when a batch fails', () => {
    const breakpoint: TaskBreakpoint = {
      stepIndex: 2,
      error: 'selector missing',
      screenshot: 'base64',
    };

    service.failBatch('batch-1', 'selector missing', breakpoint);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE task_batches'),
      ['failed', expect.any(String), 'selector missing', JSON.stringify(breakpoint), 'batch-1'],
    );
  });
});
