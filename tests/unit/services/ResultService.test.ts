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
      qualityStatus: 'passed',
      evidenceRefs: [{ kind: 'batch', refId: 'batch-1' }],
      revisionId: 'revision-1',
      createdAt: '2026-04-15T00:00:00.000Z',
    });

    expect(mockRepository.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        qualityStatus: 'passed',
        revisionId: 'revision-1',
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

  it('analyzes cross-batch result quality with required field rules', () => {
    mockRepository.listResults.mockReturnValueOnce([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: { price: 123 },
        status: 'normal',
        qualityStatus: 'passed',
        evidenceRefs: [{ kind: 'screenshot', refId: 'shot-1' }],
        revisionId: 'revision-1',
        createdAt: '2026-04-21T00:00:00.000Z',
      },
      {
        id: 'result-2',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: { title: '缺价格' },
        status: 'normal',
        qualityStatus: 'warning',
        createdAt: '2026-04-21T00:01:00.000Z',
      },
      {
        id: 'result-3',
        taskId: 'task-1',
        batchId: 'batch-2',
        data: { price: null },
        status: 'failed',
        qualityStatus: 'failed',
        createdAt: '2026-04-21T00:02:00.000Z',
      },
    ]);

    const analysis = service.analyzeCrossBatchQuality('task-1', {
      requiredFields: ['price'],
      minBatchResultCount: 2,
    });

    expect(mockRepository.listResults).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(analysis).toMatchObject({
      taskId: 'task-1',
      totalResults: 3,
      failedResults: 1,
      missingRequiredFieldResults: 2,
      tracedResults: 1,
    });
    expect(analysis.batchSummaries).toContainEqual({
      batchId: 'batch-1',
      totalResults: 2,
      failedResults: 0,
      missingRequiredFieldResults: 1,
      qualityStatus: 'warning',
    });
    expect(analysis.batchSummaries).toContainEqual({
      batchId: 'batch-2',
      totalResults: 1,
      failedResults: 1,
      missingRequiredFieldResults: 1,
      qualityStatus: 'failed',
    });
  });
});
