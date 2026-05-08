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
      getReportDetail: vi.fn((reportId) => ({ id: reportId, batchId: 'batch-1' })),
      generateReport: vi.fn((payload) => ({ id: 'report-2', ...payload })),
      deleteReport: vi.fn((reportId) => ({ reportId, deleted: true })),
      revealReport: vi.fn((reportId) => ({ reportId, revealed: true })),
    };
    const hotTimelineService = {
      listPresets: vi.fn(() => [{ preset: 'workday', schedule: { type: 'cron', cron: '*/30 9-18 * * 1-5' } }]),
    };
    const hotAiInsightService = {
      summarize: vi.fn(async (payload) => ({ summary: 'AI摘要', ...payload })),
    };
    const hotNotificationService = {
      sendReport: vi.fn(async (payload) => ({ status: 'succeeded', attempts: 1, ...payload })),
    };
    const hotResultService = {
      listResults: vi.fn(() => [{ id: 'result-1', data: { title: 'AI 芯片投资升温' } }]),
    };
    const hotConfigService = {
      saveFiles: vi.fn((payload) => ({
        configDir: 'E:/allsite/TrendRadar/config',
        files: Object.keys(payload),
      })),
    };

    registerHotHandlers({
      ipcController,
      hotSourceService,
      hotRunService,
      hotReportService,
      hotTimelineService,
      hotAiInsightService,
      hotNotificationService,
      hotResultService,
      hotConfigService,
    });

    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_SOURCE_LIST, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_DELETE, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_REVEAL, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_TIMELINE_PRESETS, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_AI_SUMMARIZE, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_NOTIFICATION_SEND, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOT_CONFIG_SAVE, expect.any(Function));

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
        format: 'html',
      }),
    ).toEqual({
      id: 'report-2',
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'html',
    });
    expect(await handlers.get(IPC_CHANNELS.HOT_REPORT_DELETE)?.({ reportId: 'report-1' })).toEqual({
      reportId: 'report-1',
      deleted: true,
    });
    expect(await handlers.get(IPC_CHANNELS.HOT_REPORT_REVEAL)?.({ reportId: 'report-1' })).toEqual({
      reportId: 'report-1',
      revealed: true,
    });
    expect(await handlers.get(IPC_CHANNELS.HOT_TIMELINE_PRESETS)?.({})).toEqual([
      { preset: 'workday', schedule: { type: 'cron', cron: '*/30 9-18 * * 1-5' } },
    ]);
    expect(
      await handlers.get(IPC_CHANNELS.HOT_AI_SUMMARIZE)?.({
        interest: '关注 AI 基建',
        batchId: 'batch-1',
      }),
    ).toMatchObject({
      interest: '关注 AI 基建',
      results: [{ id: 'result-1', data: { title: 'AI 芯片投资升温' } }],
      summary: 'AI摘要',
    });
    expect(
      await handlers.get(IPC_CHANNELS.HOT_NOTIFICATION_SEND)?.({
        reportId: 'report-1',
        target: { type: 'webhook', url: 'https://hooks.example.com/hot' },
      }),
    ).toMatchObject({
      status: 'succeeded',
      attempts: 1,
      report: { id: 'report-1' },
      results: [{ id: 'result-1', data: { title: 'AI 芯片投资升温' } }],
    });
    expect(
      await handlers.get(IPC_CHANNELS.HOT_CONFIG_SAVE)?.({
        config: 'platforms:\n',
        frequency: '[WORD_GROUPS]\n',
        timeline: 'presets: {}\n',
      }),
    ).toEqual({
      configDir: 'E:/allsite/TrendRadar/config',
      files: ['config', 'frequency', 'timeline'],
    });
  });
});
