import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskBreakpoint, StepResult } from '@shared/types';

import { BatchService } from '@main/services/BatchService';

describe('BatchService', () => {
  let service: BatchService;
  const mockRepository = {
    insertBatch: vi.fn(),
    startBatch: vi.fn(),
    finishBatch: vi.fn(),
    failBatch: vi.fn(),
    getBatch: vi.fn(),
    listBatchesByTask: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BatchService({ batchRepository: mockRepository });
  });

  it('requires batch repository injection', () => {
    expect(() => new BatchService()).toThrowError('batchRepository is required');
  });

  it('creates a pending batch by default', () => {
    const batch = service.createBatch('task-1');

    expect(mockRepository.insertBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: batch.id,
        taskId: 'task-1',
        status: 'pending',
      }),
      {},
    );
    expect(batch).toMatchObject({
      taskId: 'task-1',
      status: 'pending',
    });
    expect(batch.id).toBeTruthy();
  });

  it('moves a batch into running state when started', () => {
    service.startBatch('batch-1');

    expect(mockRepository.startBatch).toHaveBeenCalledWith('batch-1', expect.any(String));
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

    expect(mockRepository.finishBatch).toHaveBeenCalledWith(
      'batch-1',
      stepResults,
      expect.any(String),
    );
  });

  it('stores error and breakpoint when a batch fails', () => {
    const breakpoint: TaskBreakpoint = {
      stepIndex: 2,
      error: 'selector missing',
      screenshot: 'base64',
    };

    service.failBatch('batch-1', 'selector missing', breakpoint);

    expect(mockRepository.failBatch).toHaveBeenCalledWith(
      'batch-1',
      'selector missing',
      breakpoint,
      expect.any(String),
    );
  });
});
