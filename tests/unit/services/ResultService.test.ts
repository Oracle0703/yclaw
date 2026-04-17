import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultService } from '@main/services/ResultService';

describe('ResultService', () => {
  let service: ResultService;
  const mockRepository = {
    saveResult: vi.fn(),
    listResults: vi.fn(),
    getResult: vi.fn(),
    markSuspicious: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ResultService({ resultRepository: mockRepository });
  });

  it('requires result repository injection', () => {
    expect(() => new ResultService()).toThrow('resultRepository is required');
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

    expect(mockRepository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
      }),
    );
  });

  it('lists results by batch id', () => {
    mockRepository.listResults.mockReturnValueOnce([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        templateId: null,
        data: { price: 123 },
        status: 'normal',
        sourceUrl: 'https://example.com',
        screenshot: undefined,
        createdAt: '2026-04-15T00:00:00.000Z',
      },
    ]);

    const results = service.listResults({ batchId: 'batch-1' });

    expect(results).toHaveLength(1);
    expect(results[0].data).toEqual({ price: 123 });
  });

  it('marks a result as suspicious', () => {
    service.markSuspicious('result-1');

    expect(mockRepository.markSuspicious).toHaveBeenCalledWith('result-1');
  });
});
