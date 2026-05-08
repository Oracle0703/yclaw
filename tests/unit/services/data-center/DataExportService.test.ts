import { describe, expect, it, vi } from 'vitest';

import { DataExportService } from '@main/services/data-center/DataExportService';

function createExportJobRepository() {
  const state = new Map<string, Record<string, unknown>>();

  return {
    createJob: vi.fn((job) => {
      state.set(job.id, job);
      return job;
    }),
    markRetrying: vi.fn((id: string, updatedAt: string) => {
      const next = {
        ...state.get(id),
        status: 'retrying',
        retryCount: Number(state.get(id)?.retryCount ?? 0) + 1,
        updatedAt,
        error: null,
        outputPath: null,
        startedAt: null,
        finishedAt: null,
      };
      state.set(id, next);
      return next;
    }),
    markRunning: vi.fn((id: string, startedAt: string) => {
      const next = { ...state.get(id), status: 'running', startedAt, updatedAt: startedAt };
      state.set(id, next);
      return next;
    }),
    markSucceeded: vi.fn((id: string, output: { resultCount: number; outputPath: string; finishedAt: string }) => {
      const next = {
        ...state.get(id),
        status: 'succeeded',
        resultCount: output.resultCount,
        outputPath: output.outputPath,
        finishedAt: output.finishedAt,
        updatedAt: output.finishedAt,
      };
      state.set(id, next);
      return next;
    }),
    markFailed: vi.fn((id: string, error: string, finishedAt: string) => {
      const next = { ...state.get(id), status: 'failed', error, finishedAt, updatedAt: finishedAt };
      state.set(id, next);
      return next;
    }),
    markCancelled: vi.fn((id: string, finishedAt: string) => {
      const next = { ...state.get(id), status: 'cancelled', finishedAt, updatedAt: finishedAt };
      state.set(id, next);
      return next;
    }),
    appendAudit: vi.fn(),
    getJob: vi.fn((id: string) => state.get(id) ?? null),
    listJobs: vi.fn((query) => ({
      items: Array.from(state.values()).filter((job) => !query?.status || job.status === query.status),
      total: Array.from(state.values()).filter((job) => !query?.status || job.status === query.status).length,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    })),
  };
}

describe('DataExportService', () => {
  it('filters export jobs by status and cancels pending jobs', () => {
    const exportJobRepository = createExportJobRepository();
    exportJobRepository.createJob({
      id: 'export-1',
      name: 'Pending Export',
      datasetId: null,
      query: { page: 1, pageSize: 50 },
      targetType: 'file',
      targetConfig: {},
      format: 'jsonl',
      status: 'pending',
      resultCount: 0,
      outputPath: null,
      error: null,
      retryCount: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      startedAt: null,
      finishedAt: null,
    });
    exportJobRepository.createJob({
      id: 'export-2',
      name: 'Succeeded Export',
      datasetId: null,
      query: { page: 1, pageSize: 50 },
      targetType: 'file',
      targetConfig: {},
      format: 'jsonl',
      status: 'succeeded',
      resultCount: 1,
      outputPath: '/tmp/export-2.jsonl',
      error: null,
      retryCount: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      startedAt: null,
      finishedAt: null,
    });
    const service = new DataExportService({
      resultService: { listResults: vi.fn(() => []) },
      exportJobRepository,
      exporters: {},
      now: () => new Date('2026-04-22T01:00:00.000Z'),
    });

    expect(service.listJobs({ page: 1, pageSize: 20, status: 'pending' }).items).toHaveLength(1);
    const cancelled = service.cancelJob('export-1');

    expect(cancelled?.status).toBe('cancelled');
    expect(exportJobRepository.markCancelled).toHaveBeenCalledWith('export-1', '2026-04-22T01:00:00.000Z');
  });

  it('uses webhook exporter for webhook target jobs', async () => {
    const exportJobRepository = createExportJobRepository();
    const fileExporter = {
      export: vi.fn(async () => ({ outputPath: '/tmp/export-1.json', resultCount: 1 })),
    };
    const webhookExporter = {
      export: vi.fn(async () => ({ outputPath: 'webhook:http://127.0.0.1/hook', resultCount: 1 })),
    };
    const service = new DataExportService({
      resultService: {
        listResults: vi.fn(() => [
          {
            id: 'result-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { price: 1 },
            status: 'normal',
            createdAt: '2026-04-21T00:00:00.000Z',
          },
        ]),
      },
      exportJobRepository,
      exporters: {
        json: fileExporter,
        webhook: webhookExporter,
      } as never,
      now: () => new Date('2026-04-21T00:00:00.000Z'),
      createId: () => 'export-1',
    });

    const job = await service.createAndRun({
      name: 'Webhook Export',
      query: { page: 1, pageSize: 100 },
      format: 'json',
      targetType: 'webhook',
      targetConfig: { url: 'http://127.0.0.1/hook' },
    });

    expect(job.status).toBe('succeeded');
    expect(job.outputPath).toBe('webhook:http://127.0.0.1/hook');
    expect(webhookExporter.export).toHaveBeenCalled();
    expect(fileExporter.export).not.toHaveBeenCalled();
  });

  it('retries a failed export job with the saved job payload', async () => {
    const exportJobRepository = createExportJobRepository();
    exportJobRepository.createJob({
      id: 'export-1',
      name: 'Retry JSONL',
      datasetId: null,
      query: { page: 1, pageSize: 50 },
      targetType: 'file',
      targetConfig: { directory: '/tmp' },
      format: 'jsonl',
      status: 'failed',
      resultCount: 0,
      outputPath: null,
      error: 'network',
      retryCount: 0,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
      startedAt: '2026-04-21T00:00:00.000Z',
      finishedAt: '2026-04-21T00:00:00.000Z',
    });

    const exporter = {
      export: vi.fn(async () => ({ outputPath: '/tmp/export-1-retry.jsonl', resultCount: 1 })),
    };
    const service = new DataExportService({
      resultService: {
        listResults: vi.fn(() => [{ id: 'result-1', taskId: 'task-1', batchId: 'batch-1', data: { price: 1 }, status: 'normal', createdAt: '2026-04-21T00:00:00.000Z' }]),
      },
      exportJobRepository,
      exporters: { jsonl: exporter },
      now: () => new Date('2026-04-21T00:05:00.000Z'),
      createId: () => 'audit-1',
    });

    const job = await service.retryJob('export-1');

    expect(job?.status).toBe('succeeded');
    expect(job?.retryCount).toBe(1);
    expect(job?.outputPath).toBe('/tmp/export-1-retry.jsonl');
    expect(exporter.export).toHaveBeenCalled();
  });
  it('creates and completes a jsonl file export job', async () => {
    const exportJobRepository = createExportJobRepository();
    const service = new DataExportService({
      resultService: {
        listResults: vi.fn(() => [
          {
            id: 'result-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { price: 1 },
            status: 'normal',
            createdAt: '2026-04-21T00:00:00.000Z',
          },
        ]),
      },
      exportJobRepository,
      exporters: {
        jsonl: {
          export: vi.fn(async () => ({ outputPath: '/tmp/export-1.jsonl', resultCount: 1 })),
        },
      },
      now: () => new Date('2026-04-21T00:00:00.000Z'),
      createId: () => 'export-1',
    });

    const job = await service.createAndRun({
      name: 'Daily JSONL',
      query: { page: 1, pageSize: 100 },
      format: 'jsonl',
      targetType: 'file',
      targetConfig: { directory: '/tmp' },
    });

    expect(job.status).toBe('succeeded');
    expect(job.outputPath).toBe('/tmp/export-1.jsonl');
    expect(exportJobRepository.markSucceeded).toHaveBeenCalled();
  });
});
