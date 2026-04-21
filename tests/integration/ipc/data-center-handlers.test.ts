import { describe, expect, it, vi } from 'vitest';

import { IPC_CHANNELS } from '@shared/constants';
import { registerDataCenterHandlers } from '@main/ipc/data-center-handlers';

describe('registerDataCenterHandlers', () => {
  it('registers overview, detail and export channels', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const eventBus = {
      emit: vi.fn(),
    };
    const dataCenterService = {
      getOverview: vi.fn(() => ({ totalResults: 0, suspiciousResults: 0, failedExports: 0, recentExports: [] })),
      listResults: vi.fn(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
      getResultDetail: vi.fn(() => ({ result: { id: 'result-1' }, batch: null, logs: [], exports: [] })),
    };
    const dataExportService = {
      createAndRun: vi.fn(() => ({ id: 'export-1', status: 'succeeded' })),
      listJobs: vi.fn(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
      retryJob: vi.fn(() => ({ id: 'export-1', status: 'retrying' })),
      cancelJob: vi.fn(() => ({ id: 'export-1', status: 'cancelled' })),
    };
    const datasetService = {
      listDatasets: vi.fn(() => []),
      saveDataset: vi.fn(() => ({ id: 'dataset-1' })),
    };
    const webhookTargetService = {
      listTargets: vi.fn(() => []),
      saveTarget: vi.fn(() => ({ id: 'webhook-1' })),
      testTarget: vi.fn(() => ({ status: 'succeeded' })),
      deleteTarget: vi.fn(() => true),
    };
    const apiTokenService = {
      listTokens: vi.fn(() => []),
      issueToken: vi.fn(() => ({ token: { id: 'token-1' }, plainTextToken: 'token-secret' })),
      revokeToken: vi.fn(() => ({ id: 'token-1', enabled: false })),
    };
    const localDataApiService = {
      getStatus: vi.fn(() => ({ running: false })),
      start: vi.fn(() => ({ running: true, host: '127.0.0.1', port: 3941 })),
      stop: vi.fn(() => ({ running: false })),
    };
    const dataQualityService = {
      scan: vi.fn(() => ({ totalResults: 0, issueCount: 0, affectedResults: 0, rules: [], issues: [] })),
      listRuleConfigs: vi.fn(() => [{ ruleId: 'failed-result', enabled: true }]),
      saveRuleConfig: vi.fn(() => ({ ruleId: 'failed-result', enabled: false })),
      getBatchScore: vi.fn(() => ({ batchId: 'batch-1', score: 90, grade: 'excellent' })),
      getBatchInsight: vi.fn(() => ({ batchId: 'batch-1', score: 90, summary: '质量稳定。' })),
    };

    registerDataCenterHandlers({
      ipcController,
      eventBus,
      dataCenterService,
      dataExportService,
      datasetService,
      webhookTargetService,
      apiTokenService,
      localDataApiService,
      dataQualityService,
    });

    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.DATA_CENTER_OVERVIEW,
      expect.any(Function),
    );
    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.DATA_CENTER_RESULTS_DETAIL,
      expect.any(Function),
    );
    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE,
      expect.any(Function),
    );
    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.DATA_CENTER_QUALITY_SCORE_BATCH,
      expect.any(Function),
    );
    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.DATA_CENTER_QUALITY_INSIGHT_BATCH,
      expect.any(Function),
    );

    await handlers.get(IPC_CHANNELS.DATA_CENTER_OVERVIEW)?.({});
    expect(dataCenterService.getOverview).toHaveBeenCalled();

    await handlers.get(IPC_CHANNELS.DATA_CENTER_RESULTS_DETAIL)?.({ resultId: 'result-1' });
    expect(dataCenterService.getResultDetail).toHaveBeenCalledWith('result-1');

    await handlers.get(IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE)?.({
      name: 'Daily Export',
      query: { page: 1, pageSize: 20 },
      targetType: 'file',
      targetConfig: { directory: '/tmp' },
      format: 'jsonl',
    });
    expect(dataExportService.createAndRun).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(
      IPC_CHANNELS.DATA_CENTER_EXPORT_UPDATED,
      expect.objectContaining({ id: 'export-1' }),
    );

    await handlers.get(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_LIST)?.({});
    expect(webhookTargetService.listTargets).toHaveBeenCalled();

    await handlers.get(IPC_CHANNELS.DATA_CENTER_API_TOKENS_CREATE)?.({ name: 'API', scopes: ['results:read'] });
    expect(apiTokenService.issueToken).toHaveBeenCalledWith({ name: 'API', scopes: ['results:read'] });

    await handlers.get(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_TEST)?.({ target: { url: 'http://127.0.0.1:3000/hook' } });
    expect(webhookTargetService.testTarget).toHaveBeenCalledWith({ url: 'http://127.0.0.1:3000/hook' });

    await handlers.get(IPC_CHANNELS.DATA_CENTER_API_TOKENS_REVOKE)?.({ tokenId: 'token-1' });
    expect(apiTokenService.revokeToken).toHaveBeenCalledWith('token-1');

    await handlers.get(IPC_CHANNELS.DATA_CENTER_EXPORTS_CANCEL)?.({ exportJobId: 'export-1' });
    expect(dataExportService.cancelJob).toHaveBeenCalledWith('export-1');

    await handlers.get(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_DELETE)?.({ targetId: 'webhook-1' });
    expect(webhookTargetService.deleteTarget).toHaveBeenCalledWith('webhook-1');

    await handlers.get(IPC_CHANNELS.DATA_CENTER_QUALITY_SCAN)?.({});
    expect(dataQualityService.scan).toHaveBeenCalledWith({});

    await handlers.get(IPC_CHANNELS.DATA_CENTER_QUALITY_RULES_LIST)?.({});
    expect(dataQualityService.listRuleConfigs).toHaveBeenCalled();

    await handlers.get(IPC_CHANNELS.DATA_CENTER_QUALITY_RULES_SAVE)?.({
      rule: { ruleId: 'failed-result', enabled: false },
    });
    expect(dataQualityService.saveRuleConfig).toHaveBeenCalledWith({
      ruleId: 'failed-result',
      enabled: false,
    });

    await handlers.get(IPC_CHANNELS.DATA_CENTER_QUALITY_SCORE_BATCH)?.({
      batchId: 'batch-1',
    });
    expect(dataQualityService.getBatchScore).toHaveBeenCalledWith('batch-1');

    await handlers.get(IPC_CHANNELS.DATA_CENTER_QUALITY_INSIGHT_BATCH)?.({
      batchId: 'batch-1',
    });
    expect(dataQualityService.getBatchInsight).toHaveBeenCalledWith('batch-1');
  });
});
