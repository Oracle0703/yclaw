import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'YClaw'),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

const openWindowMock = vi.fn();

vi.mock('@main/windows/WindowManager', () => ({
  WindowManager: vi.fn().mockImplementation(() => ({
    openWindow: openWindowMock,
    getWindow: vi.fn(),
    getOpenModules: vi.fn(() => ['workbench']),
    closeWindow: vi.fn(),
    closeAll: vi.fn(),
  })),
}));

vi.mock('@main/ipc/EventBus', () => ({
  EventBus: {
    getInstance: vi.fn(() => ({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    })),
  },
}));

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    close: vi.fn(),
    all: vi.fn(() => []),
    get: vi.fn(() => undefined),
    run: vi.fn(() => ({ changes: 0 })),
  })),
}));

vi.mock('@main/services/ConfigService', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    get: vi.fn(() => ({})),
    getGeneral: vi.fn(() => ({ closeToTray: false })),
  })),
}));

vi.mock('@main/services/LogService', () => ({
  LogService: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@main/services/TrayService', () => ({
  TrayService: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('@main/services/UpdateService', () => ({
  UpdateService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/FeaturePackageService', () => ({
  FeaturePackageService: vi.fn().mockImplementation(() => ({
    resolveRendererUrl: vi.fn(() => null),
    isManagedModule: vi.fn(() => false),
  })),
}));

vi.mock('@main/browser/TabManager', () => ({
  TabManager: vi.fn().mockImplementation(() => ({
    closeAll: vi.fn(),
  })),
}));

vi.mock('@main/ai/AIService', () => ({
  AIService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/plugin-loader/PluginLoader', () => ({
  PluginLoader: vi.fn().mockImplementation(() => ({
    loadAll: vi.fn(),
  })),
}));

vi.mock('@main/plugin-loader/PermissionChecker', () => ({
  PermissionChecker: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/TaskService', () => ({
  TaskService: vi.fn().mockImplementation(() => ({
    listTasks: vi.fn(() => []),
    listBatches: vi.fn(() => []),
  })),
}));

vi.mock('@main/services/RemoteRunnerService', () => ({
  RemoteRunnerService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/SchedulerService', () => ({
  SchedulerService: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
  })),
}));

vi.mock('@main/services/SessionRegistry', () => ({
  SessionRegistry: vi.fn().mockImplementation(() => ({
    listSessions: vi.fn(() => []),
  })),
}));

vi.mock('@main/services/TemplateService', () => ({
  TemplateService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/ExecutionLogService', () => ({
  ExecutionLogService: vi.fn().mockImplementation(() => ({
    query: vi.fn(() => []),
  })),
}));

vi.mock('@main/services/AlertService', () => ({
  AlertService: vi.fn().mockImplementation(() => ({
    listAlerts: vi.fn(() => []),
  })),
}));

vi.mock('@main/services/ReviewService', () => ({
  ReviewService: vi.fn().mockImplementation(() => ({
    listReviews: vi.fn(() => []),
  })),
}));

vi.mock('@main/services/ResultService', () => ({
  ResultService: vi.fn().mockImplementation(() => ({
    listResults: vi.fn(() => []),
  })),
}));

vi.mock('@main/services/WorkspaceService', () => ({
  WorkspaceService: vi.fn().mockImplementation(() => ({
    listWorkspaces: vi.fn(() => []),
  })),
}));

vi.mock('@main/services/TaskRevisionService', () => ({
  TaskRevisionService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/OperationsMetricsService', () => ({
  OperationsMetricsService: vi.fn().mockImplementation(() => ({
    buildAcceptanceMetrics: vi.fn(() => ({})),
  })),
}));

vi.mock('@main/services/data-center/DataCenterService', () => ({
  DataCenterService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/DataQualityService', () => ({
  DataQualityService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/DataExportService', () => ({
  DataExportService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/DatasetService', () => ({
  DatasetService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/WebhookTargetService', () => ({
  WebhookTargetService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/ApiTokenService', () => ({
  ApiTokenService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/LocalDataApiService', () => ({
  LocalDataApiService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/WebhookDeliveryService', () => ({
  WebhookDeliveryService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/exporters/CsvExporter', () => ({
  CsvExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/exporters/JsonExporter', () => ({
  JsonExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/exporters/JsonlExporter', () => ({
  JsonlExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/data-center/exporters/WebhookExporter', () => ({
  WebhookExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@engines/analytics/DataSourceManager', () => ({
  DataSourceManager: vi.fn().mockImplementation(() => ({
    closeAll: vi.fn(),
  })),
}));

vi.mock('@engines/analytics/IndicatorLibrary', () => ({
  IndicatorLibrary: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@engines/automation/AutomationEngine', () => ({
  AutomationEngine: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@engines/automation/FlowRunner', () => ({
  FlowRunner: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@mcp/server/createDesktopMcpServer', () => ({
  createDesktopMcpServer: vi.fn(() => ({})),
}));

vi.mock('@mcp/server/startEmbeddedHttpServer', () => ({
  startEmbeddedMcpHttpServer: vi.fn(),
}));

vi.mock('@mcp/client/McpClientManager', () => ({
  McpClientManager: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    getServerStatuses: vi.fn(() => []),
    syncServers: vi.fn(),
  })),
}));

vi.mock('@main/ipc/remote-runner-handlers', () => ({
  registerRemoteRunnerHandlers: vi.fn(),
}));

vi.mock('@main/ipc/runner-scheduler-handlers', () => ({
  registerRunnerSchedulerHandlers: vi.fn(),
}));

vi.mock('@main/ipc/task-operations-handlers', () => ({
  registerTaskOperationsHandlers: vi.fn(),
}));

vi.mock('@main/ipc/data-center-handlers', () => ({
  registerDataCenterHandlers: vi.fn(),
}));

vi.mock('@main/services/task-as-code/bootstrap', () => ({
  bootstrapTaskAsCode: vi.fn(() => ({
    dispose: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@main/services/repositories', () => {
  const makeClass = () =>
    vi.fn().mockImplementation(() => ({
      getTasks: vi.fn(() => []),
      listTasks: vi.fn(() => []),
    }));

  return {
    AIRepository: makeClass(),
    AlertRepository: makeClass(),
    BatchRepository: makeClass(),
    ExecutionLogRepository: makeClass(),
    HotReportRepository: makeClass(),
    HotSourceRepository: makeClass(),
    CommentReportRepository: makeClass(),
    CommentSourceRepository: makeClass(),
    DataApiTokenRepository: makeClass(),
    DataQualityBatchInsightRepository: makeClass(),
    DataQualityFindingRepository: makeClass(),
    DataDatasetRepository: makeClass(),
    DataExportJobRepository: makeClass(),
    DataQualityRuleRepository: makeClass(),
    DataWebhookTargetRepository: makeClass(),
    PluginRepository: makeClass(),
    RemoteRunnerRepository: makeClass(),
    ReviewRepository: makeClass(),
    ResultRepository: makeClass(),
    RunnerSchedulerRepository: vi.fn().mockImplementation(() => ({
      listRunnerNodes: vi.fn(() => []),
      listQueueItems: vi.fn(() => []),
      saveQueueItem: vi.fn(),
      saveExecutionLease: vi.fn(),
    })),
    SessionRepository: makeClass(),
    SigninRunRepository: makeClass(),
    TaskRepository: vi.fn().mockImplementation(() => ({
      getTasks: vi.fn(() => []),
    })),
    TaskRevisionRepository: makeClass(),
    TemplateRepository: makeClass(),
    WorkspaceRepository: makeClass(),
  };
});

vi.mock('@main/services/runner-scheduler', () => ({
  DispatchQueueService: vi.fn().mockImplementation(() => ({
    enqueue: vi.fn(),
  })),
  ExecutionLeaseService: vi.fn().mockImplementation(() => ({})),
  LeaseReconciler: vi.fn().mockImplementation(() => ({
    reconcile: vi.fn(),
  })),
  LocalRunnerAdapter: vi.fn().mockImplementation(() => ({})),
  RemoteRunnerAdapter: vi.fn().mockImplementation(() => ({})),
  RunnerDispatchService: vi.fn().mockImplementation(() => ({
    tick: vi.fn(),
  })),
  RunnerRegistryService: vi.fn().mockImplementation(() => ({
    heartbeat: vi.fn(),
    drain: vi.fn(),
    resume: vi.fn(),
  })),
}));

import { App } from '@main/app';
import { WindowManager } from '@main/windows/WindowManager';

describe('App.showWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('通过 WindowManager 打开或聚焦主工作台窗口', () => {
    const application = new App();

    application.showWorkbench();

    const instance = (WindowManager as unknown as Mock).mock.results.at(-1)?.value as {
      openWindow: Mock;
    };

    expect(instance.openWindow).toHaveBeenCalledWith({ module: 'workbench' });
  });
});
