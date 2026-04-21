import { IPC_CHANNELS } from '@shared/constants';

type Invoke = (channel: string, payload?: unknown) => Promise<unknown>;
type On = (channel: string, callback: (...args: unknown[]) => void) => () => void;

export function createDataCenterApi(options: { invoke: Invoke; on?: On }) {
  return {
    getOverview: () => options.invoke(IPC_CHANNELS.DATA_CENTER_OVERVIEW),
    listResults: (payload: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_RESULTS_LIST, payload),
    getResultDetail: (resultId: string) =>
      options.invoke(IPC_CHANNELS.DATA_CENTER_RESULTS_DETAIL, { resultId }),
    createExport: (payload: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE, payload),
    listExports: (payload?: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_EXPORTS_LIST, payload),
    retryExport: (exportJobId: string) =>
      options.invoke(IPC_CHANNELS.DATA_CENTER_EXPORTS_RETRY, { exportJobId }),
    listDatasets: () => options.invoke(IPC_CHANNELS.DATA_CENTER_DATASETS_LIST),
    saveDataset: (dataset: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_DATASETS_SAVE, { dataset }),
    listWebhookTargets: () => options.invoke(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_LIST),
    saveWebhookTarget: (target: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_SAVE, { target }),
    testWebhookTarget: (target: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_TEST, { target }),
    deleteWebhookTarget: (targetId: string) => options.invoke(IPC_CHANNELS.DATA_CENTER_WEBHOOKS_DELETE, { targetId }),
    listApiTokens: () => options.invoke(IPC_CHANNELS.DATA_CENTER_API_TOKENS_LIST),
    createApiToken: (payload: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_API_TOKENS_CREATE, payload),
    revokeApiToken: (tokenId: string) => options.invoke(IPC_CHANNELS.DATA_CENTER_API_TOKENS_REVOKE, { tokenId }),
    cancelExport: (exportJobId: string) => options.invoke(IPC_CHANNELS.DATA_CENTER_EXPORTS_CANCEL, { exportJobId }),
    getApiStatus: () => options.invoke(IPC_CHANNELS.DATA_CENTER_API_STATUS),
    startApi: (payload?: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_API_START, payload),
    stopApi: () => options.invoke(IPC_CHANNELS.DATA_CENTER_API_STOP),
    scanQuality: (payload?: unknown) => options.invoke(IPC_CHANNELS.DATA_CENTER_QUALITY_SCAN, payload),
    getBatchQualityScore: (batchId: string) =>
      options.invoke(IPC_CHANNELS.DATA_CENTER_QUALITY_SCORE_BATCH, { batchId }),
    getBatchQualityInsight: (batchId: string) =>
      options.invoke(IPC_CHANNELS.DATA_CENTER_QUALITY_INSIGHT_BATCH, { batchId }),
    listQualityRules: () => options.invoke(IPC_CHANNELS.DATA_CENTER_QUALITY_RULES_LIST),
    saveQualityRule: (rule: unknown) =>
      options.invoke(IPC_CHANNELS.DATA_CENTER_QUALITY_RULES_SAVE, { rule }),
    onExportUpdated: (callback: (...args: unknown[]) => void) =>
      options.on ? options.on(IPC_CHANNELS.DATA_CENTER_EXPORT_UPDATED, callback) : () => undefined,
  };
}
