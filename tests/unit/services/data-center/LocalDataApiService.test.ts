import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalDataApiService } from '@main/services/data-center/LocalDataApiService';

describe('LocalDataApiService', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('rejects readonly requests when a token verifier is configured', async () => {
    const service = new LocalDataApiService({
      dataCenterService: {
        listResults: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
      },
      tokenVerifier: {
        verifyToken: vi.fn(() => false),
      },
    });

    const status = await service.start({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`http://${status.host}:${status.port}/results`);

    expect(response.status).toBe(401);
    await service.stop();
  });

  it('starts a local readonly api and serves datasets/results/exports', async () => {
    const service = new LocalDataApiService({
      dataCenterService: {
        listResults: vi.fn(async () => ({
          items: [{ id: 'result-1', taskId: 'task-1', batchId: 'batch-1', data: { price: 1 }, status: 'normal', createdAt: '2026-04-21T00:00:00.000Z' }],
          total: 1,
          page: 1,
          pageSize: 20,
        })),
      },
      datasetService: {
        listDatasets: vi.fn(() => [{
          id: 'dataset-1',
          name: '默认数据集',
          query: { page: 1, pageSize: 20 },
          defaultFormat: 'jsonl',
          apiEnabled: true,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }]),
      },
      dataExportService: {
        listJobs: vi.fn(() => ({ items: [{ id: 'export-1', name: 'exp', query: { page: 1, pageSize: 20 }, targetType: 'file', targetConfig: {}, format: 'jsonl', status: 'succeeded', resultCount: 1, retryCount: 0, createdAt: '2026-04-21T00:00:00.000Z', updatedAt: '2026-04-21T00:00:00.000Z' }], total: 1, page: 1, pageSize: 20 })),
      },
    });

    const status = await service.start({ host: '127.0.0.1', port: 0 });
    expect(status.running).toBe(true);
    expect(status.port).toBeGreaterThan(0);

    const datasetsResponse = await fetch(`http://${status.host}:${status.port}/datasets`);
    expect(datasetsResponse.status).toBe(200);
    await expect(datasetsResponse.json()).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'dataset-1' })],
      }),
    );

    const resultsResponse = await fetch(`http://${status.host}:${status.port}/results?page=1&pageSize=20`);
    expect(resultsResponse.status).toBe(200);
    await expect(resultsResponse.json()).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'result-1' })],
      }),
    );

    const exportsResponse = await fetch(`http://${status.host}:${status.port}/exports?page=1&pageSize=20`);
    expect(exportsResponse.status).toBe(200);
    await expect(exportsResponse.json()).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'export-1' })],
      }),
    );

    const stopped = await service.stop();
    expect(stopped.running).toBe(false);
  });
});
