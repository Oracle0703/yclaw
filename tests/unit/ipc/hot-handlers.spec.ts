import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerHotHandlers } from '@main/ipc/hot-handlers';

describe('registerHotHandlers', () => {
  it('registers source, run and report channels', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const hotSourceService = {
      listSources: vi.fn(() => [{ id: 'source-1' }]),
      getSource: vi.fn((sourceId) => ({ id: sourceId })),
      createSource: vi.fn((payload) => ({ id: 'source-new', ...payload })),
      updateSource: vi.fn((sourceId, payload) => ({ id: sourceId, ...payload })),
      deleteSource: vi.fn((sourceId) => ({ sourceId })),
    };
    const hotRunService = {
      listRuns: vi.fn(() => [{ batchId: 'batch-1' }]),
      getRunDetail: vi.fn((sourceId, batchId) => ({ sourceId, batchId })),
      startRun: vi.fn((sourceId) => ({ sourceId, started: true })),
    };
    const hotReportService = {
      listReports: vi.fn(() => [{ id: 'report-1' }]),
      getReportDetail: vi.fn((reportId) => ({ id: reportId })),
      generateReport: vi.fn((payload) => ({ id: 'report-2', ...payload })),
    };

    registerHotHandlers({
      ipcController,
      hotSourceService,
      hotRunService,
      hotReportService,
    });

    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_SOURCE_LIST, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, expect.any(Function));

    expect(await handlers.get(IPC_CHANNELS.HOT_SOURCE_LIST)?.({})).toEqual([{ id: 'source-1' }]);
    expect(
      await handlers.get(IPC_CHANNELS.HOT_SOURCE_CREATE)?.({
        name: '抖音热榜',
      }),
    ).toEqual({ id: 'source-new', name: '抖音热榜' });
    expect(
      await handlers.get(IPC_CHANNELS.HOT_SOURCE_UPDATE)?.({
        sourceId: 'source-1',
        updates: { name: '抖音热榜更新版' },
      }),
    ).toEqual({ id: 'source-1', name: '抖音热榜更新版' });
    expect(await handlers.get(IPC_CHANNELS.HOT_RUN_START)?.({ sourceId: 'source-1' })).toEqual({
      sourceId: 'source-1',
      started: true,
    });
    expect(
      await handlers.get(IPC_CHANNELS.HOT_REPORT_GENERATE)?.({
        sourceId: 'source-1',
        batchId: 'batch-1',
        format: 'md',
      }),
    ).toEqual({
      id: 'report-2',
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'md',
    });
  });
});
