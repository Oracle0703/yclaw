import { describe, expect, it, vi } from 'vitest';

import { DataCenterService } from '@main/services/data-center/DataCenterService';

describe('DataCenterService', () => {
  it('builds result detail with logs and batch context', async () => {
    const service = new DataCenterService({
      resultService: {
        listResults: vi.fn(() => []),
        getResult: vi.fn(() => ({
          id: 'result-1',
          taskId: 'task-1',
          batchId: 'batch-1',
          data: { price: 1 },
          status: 'normal',
          createdAt: '2026-04-21T00:00:00.000Z',
        })),
      },
      batchService: {
        getBatch: vi.fn(() => ({
          id: 'batch-1',
          taskId: 'task-1',
          status: 'success',
          stepResults: [],
          createdAt: '2026-04-21T00:00:00.000Z',
        })),
      },
      executionLogService: {
        query: vi.fn(() => [
          {
            id: 1,
            taskId: 'task-1',
            batchId: 'batch-1',
            level: 'info',
            message: 'ok',
            createdAt: '2026-04-21T00:00:01.000Z',
          },
        ]),
      },
      dataExportJobRepository: {
        listJobs: vi.fn(() => ({ items: [], total: 0, page: 1, pageSize: 10 })),
        listByResultId: vi.fn(() => []),
      },
    });

    const detail = await service.getResultDetail('result-1');

    expect(detail.result.id).toBe('result-1');
    expect(detail.batch?.id).toBe('batch-1');
    expect(detail.logs).toHaveLength(1);
  });
});
