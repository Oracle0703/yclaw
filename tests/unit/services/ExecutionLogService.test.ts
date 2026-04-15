import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { ExecutionLogService } from '@main/services/ExecutionLogService';

describe('ExecutionLogService', () => {
  let service: ExecutionLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExecutionLogService();
  });

  it('appends structured execution logs', () => {
    service.append({
      taskId: 'task-1',
      batchId: 'batch-1',
      stepIndex: 0,
      level: 'info',
      message: 'step started',
    });

    expect(mockDb.run).toHaveBeenCalled();
  });

  it('queries logs by batch id', () => {
    mockDb.all.mockReturnValueOnce([
      {
        id: 1,
        task_id: 'task-1',
        batch_id: 'batch-1',
        step_index: 0,
        level: 'error',
        message: 'step failed',
        metadata: JSON.stringify({ screenshot: 'data:image/png;base64,mock' }),
        created_at: '2026-04-15T00:00:00.000Z',
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
