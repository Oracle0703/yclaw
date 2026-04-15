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

import { ResultService } from '@main/services/ResultService';

describe('ResultService', () => {
  let service: ResultService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ResultService();
  });

  it('stores extraction result records', () => {
    service.saveResult({
      id: 'result-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      data: { price: 123 },
      status: 'normal',
      createdAt: '2026-04-15T00:00:00.000Z',
    });

    expect(mockDb.run).toHaveBeenCalled();
  });

  it('lists results by batch id', () => {
    mockDb.all.mockReturnValueOnce([
      {
        id: 'result-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        template_id: null,
        data: JSON.stringify({ price: 123 }),
        status: 'normal',
        source_url: 'https://example.com',
        screenshot: null,
        created_at: '2026-04-15T00:00:00.000Z',
      },
    ]);

    const results = service.listResults({ batchId: 'batch-1' });

    expect(results).toHaveLength(1);
    expect(results[0].data).toEqual({ price: 123 });
  });

  it('marks a result as suspicious', () => {
    service.markSuspicious('result-1');

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE extraction_results'),
      ['suspicious', 'result-1'],
    );
  });
});
