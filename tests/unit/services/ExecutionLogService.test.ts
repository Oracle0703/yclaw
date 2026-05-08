import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutionLogService } from '@main/services/ExecutionLogService';

describe('ExecutionLogService', () => {
  let service: ExecutionLogService;
  const mockRepository = {
    append: vi.fn(),
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExecutionLogService({ executionLogRepository: mockRepository });
  });

  it('requires execution log repository injection', () => {
    expect(() => new ExecutionLogService()).toThrow('executionLogRepository is required');
  });

  it('appends structured execution logs', () => {
    service.append({
      taskId: 'task-1',
      batchId: 'batch-1',
      stepIndex: 0,
      level: 'info',
      message: 'step started',
    });

    expect(mockRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        batchId: 'batch-1',
        stepIndex: 0,
      }),
    );
  });

  it('queries logs by batch id', () => {
    mockRepository.query.mockReturnValueOnce([
      {
        id: 1,
        taskId: 'task-1',
        batchId: 'batch-1',
        stepIndex: 0,
        level: 'error',
        message: 'step failed',
        metadata: { screenshot: 'data:image/png;base64,mock' },
        createdAt: '2026-04-15T00:00:00.000Z',
      },
    ]);

    const logs = service.query({ batchId: 'batch-1' });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      batchId: 'batch-1',
      level: 'error',
    });
  });
});
