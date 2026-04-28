import { IPC_CHANNELS } from '@shared/constants';

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
    generateReport(payload: { sourceId: string; batchId: string; format: 'md' | 'docx' }): unknown;
  };
}): void {
  const { ipcController, hotSourceService, hotRunService, hotReportService } = options;

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

function assertFormat(value: unknown): 'md' | 'docx' {
  if (value === 'md' || value === 'docx') {
    return value;
  }
  throw new Error('format is required');
}
