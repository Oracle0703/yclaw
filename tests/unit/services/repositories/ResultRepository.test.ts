import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractionResult } from '@shared/types';
import { ResultRepository } from '@main/services/repositories/ResultRepository';

function createExecutor() {
  return {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
  };
}

describe('ResultRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: ResultRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new ResultRepository(executor);
  });

  it('inserts normalized extraction results', () => {
    const result: ExtractionResult = {
      id: 'result-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      templateId: null,
      data: { price: 123 },
      status: 'normal',
      sourceUrl: 'https://example.com',
      screenshot: undefined,
      createdAt: '2026-04-17T00:00:00.000Z',
    };

    repository.saveResult(result);

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO extraction_results'),
      [
        'result-1',
        'task-1',
        'batch-1',
        null,
        JSON.stringify({ price: 123 }),
        'normal',
        'https://example.com',
        null,
        '2026-04-17T00:00:00.000Z',
      ],
    );
  });

  it('lists and fetches results with parsed data payloads', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'result-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        template_id: null,
        data: JSON.stringify({ price: 123 }),
        status: 'normal',
        source_url: null,
        screenshot: 'shot.png',
        created_at: '2026-04-17T00:00:00.000Z',
      },
    ]);
    executor.get.mockReturnValueOnce({
      id: 'result-1',
      task_id: 'task-1',
      batch_id: 'batch-1',
      template_id: 'template-1',
      data: JSON.stringify({ price: 123 }),
      status: 'suspicious',
      source_url: 'https://example.com',
      screenshot: null,
      created_at: '2026-04-17T00:00:00.000Z',
    });

    expect(repository.listResults({ batchId: 'batch-1' })).toEqual([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        templateId: null,
        data: { price: 123 },
        status: 'normal',
        sourceUrl: undefined,
        screenshot: 'shot.png',
        createdAt: '2026-04-17T00:00:00.000Z',
      },
    ]);
    expect(repository.getResult('result-1')).toEqual({
      id: 'result-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      templateId: 'template-1',
      data: { price: 123 },
      status: 'suspicious',
      sourceUrl: 'https://example.com',
      screenshot: undefined,
      createdAt: '2026-04-17T00:00:00.000Z',
    });
  });

  it('marks result as suspicious', () => {
    repository.markSuspicious('result-1');

    expect(executor.run).toHaveBeenCalledWith(
      'UPDATE extraction_results SET status = ? WHERE id = ?',
      ['suspicious', 'result-1'],
    );
  });
});
