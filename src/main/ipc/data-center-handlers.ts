import { IPC_CHANNELS } from '@shared/constants';

type IpcControllerLike = {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
};

type EventBusLike = {
  emit(channel: string, payload: unknown): void;
};

export function registerDataCenterHandlers(options: {
  ipcController: IpcControllerLike;
  eventBus: EventBusLike;
  dataCenterService: {
    getOverview(): unknown;
    listResults(payload: unknown): unknown;
    getResultDetail(resultId: string): unknown;
  };
  dataExportService: {
    createAndRun(payload: unknown): unknown;
    listJobs(payload?: unknown): unknown;
    retryJob?(exportJobId: string): unknown;
    cancelJob?(exportJobId: string): unknown;
  };
  datasetService: {
    listDatasets(): unknown;
    saveDataset(payload: unknown): unknown;
  };
  webhookTargetService: {
    listTargets(): unknown;
    saveTarget(payload: unknown): unknown;
    testTarget(payload: unknown): unknown;
    deleteTarget(targetId: string): unknown;
  };
  apiTokenService: {
    listTokens(): unknown;
    issueToken(payload: unknown): unknown;
    revokeToken(tokenId: string): unknown;
  };
  localDataApiService: {
    getStatus(): unknown;
    start(payload?: unknown): unknown;
    stop(): unknown;
  };
  dataQualityService: {
    scan(payload?: unknown): unknown;
    getBatchScore(batchId: string): unknown;
    getBatchInsight(batchId: string): unknown;
    listRuleConfigs(): unknown;
    saveRuleConfig(payload: unknown): unknown;
  };
}): void {
  const {
    ipcController,
    eventBus,
    dataCenterService,
    dataExportService,
    datasetService,
    webhookTargetService,
    apiTokenService,
    localDataApiService,
    dataQualityService,
  } = options;

  ipcController.handle(IPC_CHANNELS.DATA_CENTER_OVERVIEW, () => dataCenterService.getOverview());
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_RESULTS_LIST, (payload) =>
    dataCenterService.listResults(payload),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_RESULTS_DETAIL, (payload) =>
    dataCenterService.getResultDetail(assertStringField(payload, 'resultId')),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE, async (payload) => {
    const result = await dataExportService.createAndRun(payload);
    eventBus.emit(IPC_CHANNELS.DATA_CENTER_EXPORT_UPDATED, result);
    return result;
  });
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_EXPORTS_LIST, (payload) =>
    dataExportService.listJobs(payload),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_EXPORTS_RETRY, (payload) => {
    const result = dataExportService.retryJob?.(assertStringField(payload, 'exportJobId')) ?? null;
    if (result) {
      eventBus.emit(IPC_CHANNELS.DATA_CENTER_EXPORT_UPDATED, result);
    }
    return result;
  });
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_EXPORTS_CANCEL, (payload) => {
    const result = dataExportService.cancelJob?.(assertStringField(payload, 'exportJobId')) ?? null;
    if (result) {
      eventBus.emit(IPC_CHANNELS.DATA_CENTER_EXPORT_UPDATED, result);
    }
    return result;
  });
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_DATASETS_LIST, () => datasetService.listDatasets());
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_DATASETS_SAVE, (payload) =>
    datasetService.saveDataset((payload as { dataset?: unknown })?.dataset ?? payload),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_LIST, () => webhookTargetService.listTargets());
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_SAVE, (payload) =>
    webhookTargetService.saveTarget((payload as { target?: unknown })?.target ?? payload),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_TEST, (payload) =>
    webhookTargetService.testTarget((payload as { target?: unknown })?.target ?? payload),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_DELETE, (payload) =>
    webhookTargetService.deleteTarget(assertStringField(payload, 'targetId')),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_API_TOKENS_LIST, () => apiTokenService.listTokens());
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_API_TOKENS_CREATE, (payload) => apiTokenService.issueToken(payload));
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_API_TOKENS_REVOKE, (payload) =>
    apiTokenService.revokeToken(assertStringField(payload, 'tokenId')),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_API_STATUS, () => localDataApiService.getStatus());
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_API_START, (payload) => localDataApiService.start(payload));
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_API_STOP, () => localDataApiService.stop());
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_QUALITY_SCAN, (payload) =>
    dataQualityService.scan(payload),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_QUALITY_SCORE_BATCH, (payload) =>
    dataQualityService.getBatchScore(assertStringField(payload, 'batchId')),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_QUALITY_INSIGHT_BATCH, (payload) =>
    dataQualityService.getBatchInsight(assertStringField(payload, 'batchId')),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_QUALITY_RULES_LIST, () =>
    dataQualityService.listRuleConfigs(),
  );
  ipcController.handle(IPC_CHANNELS.DATA_CENTER_QUALITY_RULES_SAVE, (payload) =>
    dataQualityService.saveRuleConfig((payload as { rule?: unknown })?.rule ?? payload),
  );
}

function assertStringField(payload: unknown, key: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    key in payload &&
    typeof (payload as Record<string, unknown>)[key] === 'string'
  ) {
    return String((payload as Record<string, unknown>)[key]);
  }

  throw new Error(`${key} is required`);
}
