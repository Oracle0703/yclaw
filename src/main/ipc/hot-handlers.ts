import { IPC_CHANNELS } from '@shared/constants';
import type { ExtractionResult, HotReportFormat, HotReportSummary } from '@shared/types';

type IpcControllerLike = {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
};

export function registerHotHandlers(options: {
  ipcController: IpcControllerLike;
  hotSourceService: {
    listSources(): unknown;
    getSource(sourceId: string): unknown;
    createSource(payload: unknown): unknown;
    updateSource(sourceId: string, updates: unknown): unknown;
    deleteSource(sourceId: string): unknown;
  };
  hotRunService: {
    listRuns(sourceId?: string): unknown;
    getRunDetail(sourceId: string, batchId: string): unknown;
    startRun(sourceId: string): unknown;
  };
  hotReportService: {
    listReports(query?: unknown): unknown;
    getReportDetail(reportId: string): unknown;
    generateReport(payload: { sourceId: string; batchId: string; format: HotReportFormat }): unknown;
    deleteReport(reportId: string): unknown;
    revealReport(reportId: string): unknown;
  };
  hotTimelineService: {
    listPresets(): unknown;
  };
  hotAiInsightService: {
    summarize(payload: { interest: string; results: ExtractionResult[] }): unknown;
  };
  hotNotificationService: {
    sendReport(payload: {
      target: { type: 'webhook'; url: string; headers?: Record<string, string>; maxRetries?: number; timeoutMs?: number };
      report: HotReportSummary;
      results: ExtractionResult[];
    }): unknown;
  };
  hotResultService: {
    listResults(query?: { batchId?: string }): ExtractionResult[];
  };
  hotConfigService?: {
    saveFiles(payload: { config: string; frequency: string; timeline: string }): unknown;
  };
}): void {
  const {
    ipcController,
    hotSourceService,
    hotRunService,
    hotReportService,
    hotTimelineService,
    hotAiInsightService,
    hotNotificationService,
    hotResultService,
    hotConfigService,
  } = options;

  ipcController.handle(IPC_CHANNELS.HOT_SOURCE_LIST, () => hotSourceService.listSources());
  ipcController.handle(IPC_CHANNELS.HOT_SOURCE_DETAIL, (payload) =>
    hotSourceService.getSource(assertStringField(payload, 'sourceId')),
  );
  ipcController.handle(IPC_CHANNELS.HOT_SOURCE_CREATE, (payload) =>
    hotSourceService.createSource(assertObject(payload)),
  );
  ipcController.handle(IPC_CHANNELS.HOT_SOURCE_UPDATE, (payload) => {
    const body = assertObject(payload);
    return hotSourceService.updateSource(
      assertStringField(body, 'sourceId'),
      assertObject(body.updates),
    );
  });
  ipcController.handle(IPC_CHANNELS.HOT_SOURCE_DELETE, (payload) =>
    hotSourceService.deleteSource(assertStringField(payload, 'sourceId')),
  );

  ipcController.handle(IPC_CHANNELS.HOT_RUN_LIST, (payload) => {
    const body = payload == null ? {} : assertObject(payload);
    return hotRunService.listRuns(
      typeof body.sourceId === 'string' && body.sourceId.length > 0 ? body.sourceId : undefined,
    );
  });
  ipcController.handle(IPC_CHANNELS.HOT_RUN_DETAIL, (payload) => {
    const body = assertObject(payload);
    return hotRunService.getRunDetail(
      assertStringField(body, 'sourceId'),
      assertStringField(body, 'batchId'),
    );
  });
  ipcController.handle(IPC_CHANNELS.HOT_RUN_START, (payload) =>
    hotRunService.startRun(assertStringField(payload, 'sourceId')),
  );

  ipcController.handle(IPC_CHANNELS.HOT_REPORT_LIST, (payload) =>
    hotReportService.listReports(payload == null ? {} : assertObject(payload)),
  );
  ipcController.handle(IPC_CHANNELS.HOT_REPORT_DETAIL, (payload) =>
    hotReportService.getReportDetail(assertStringField(payload, 'reportId')),
  );
  ipcController.handle(IPC_CHANNELS.HOT_REPORT_GENERATE, (payload) => {
    const body = assertObject(payload);
    return hotReportService.generateReport({
      sourceId: assertStringField(body, 'sourceId'),
      batchId: assertStringField(body, 'batchId'),
      format: assertFormat(body.format),
    });
  });
  ipcController.handle(IPC_CHANNELS.HOT_REPORT_DELETE, (payload) =>
    hotReportService.deleteReport(assertStringField(payload, 'reportId')),
  );
  ipcController.handle(IPC_CHANNELS.HOT_REPORT_REVEAL, (payload) =>
    hotReportService.revealReport(assertStringField(payload, 'reportId')),
  );

  ipcController.handle(IPC_CHANNELS.HOT_TIMELINE_PRESETS, () => hotTimelineService.listPresets());
  ipcController.handle(IPC_CHANNELS.HOT_AI_SUMMARIZE, (payload) => {
    const body = assertObject(payload);
    const batchId = assertStringField(body, 'batchId');
    return hotAiInsightService.summarize({
      interest: assertStringField(body, 'interest'),
      results: hotResultService.listResults({ batchId }),
    });
  });
  ipcController.handle(IPC_CHANNELS.HOT_NOTIFICATION_SEND, (payload) => {
    const body = assertObject(payload);
    const report = hotReportService.getReportDetail(assertStringField(body, 'reportId'));
    if (!isHotReportSummary(report)) {
      throw new Error('report not found');
    }

    return hotNotificationService.sendReport({
      target: assertWebhookTarget(body.target),
      report,
      results: hotResultService.listResults({ batchId: report.batchId }),
    });
  });

  if (hotConfigService) {
    ipcController.handle(IPC_CHANNELS.HOT_CONFIG_SAVE, (payload) => {
      const body = assertObject(payload);
      return hotConfigService.saveFiles({
        config: assertStringField(body, 'config'),
        frequency: assertStringField(body, 'frequency'),
        timeline: assertStringField(body, 'timeline'),
      });
    });
  }
}

function assertObject(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload == null) {
    throw new Error('payload object is required');
  }
  return payload as Record<string, unknown>;
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

function assertFormat(value: unknown): HotReportFormat {
  if (value === 'md' || value === 'html' || value === 'docx') {
    return value;
  }
  throw new Error('format is required');
}

function assertWebhookTarget(value: unknown): {
  type: 'webhook';
  url: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
} {
  const target = assertObject(value);
  if (target.type !== 'webhook') {
    throw new Error('webhook target is required');
  }

  const url = assertStringField(target, 'url');
  return {
    type: 'webhook',
    url,
    ...(isStringRecord(target.headers) ? { headers: target.headers } : {}),
    ...(typeof target.maxRetries === 'number' ? { maxRetries: target.maxRetries } : {}),
    ...(typeof target.timeoutMs === 'number' ? { timeoutMs: target.timeoutMs } : {}),
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && Object.values(value).every((item) => typeof item === 'string');
}

function isHotReportSummary(value: unknown): value is HotReportSummary {
  return typeof value === 'object'
    && value !== null
    && typeof (value as HotReportSummary).id === 'string'
    && typeof (value as HotReportSummary).batchId === 'string';
}
