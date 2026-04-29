import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { AIService } from '@main/ai/AIService';
import { SessionRegistry } from '@main/services/SessionRegistry';
import { TemplateService } from '@main/services/TemplateService';
import { AlertService } from '@main/services/AlertService';
import { ResultService } from '@main/services/ResultService';
import { ExecutionLogService } from '@main/services/ExecutionLogService';

type MockIpcHandler = (...args: unknown[]) => unknown | Promise<unknown>;

const handlers = new Map<string, MockIpcHandler>();
const mockOpenWindow = vi.fn();
const mockGetWindow = vi.fn();
const mockGetOpenModules = vi.fn(() => ['workbench']);
const mockCloseWindow = vi.fn();
const mockCloseAllWindows = vi.fn();
const mockOpenDb = vi.fn();
const mockCloseDb = vi.fn();
const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbTransaction = vi.fn((fn: () => unknown) => fn());
function buildGenericTaskFlow(taskId: string) {
  return {
    id: taskId,
    name: '采集任务',
    steps: [
      {
        id: 'step-1',
        name: '打开页面',
        action: { type: 'click', selector: '#open' },
      },
    ],
    createdAt: '2026-04-16T00:00:00.000Z',
    updatedAt: '2026-04-16T00:00:00.000Z',
  };
}

function buildSigninTaskFlow(taskId: string) {
  return {
    id: taskId,
    name: '阿里云盘签到',
    kind: 'aliyundrive-signin' as const,
    steps: [],
    entryUrl: 'https://www.aliyundrive.com/',
    sessionId: 'session-signin-1',
    signin: {
      site: 'aliyundrive' as const,
      mode: 'api-first-browser-fallback' as const,
      fallbackApiEnabled: true,
      refreshToken: null,
      maxRetryPerDay: 1,
      manualInterventionEnabled: true as const,
    },
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}

function createWebStorage(source: Record<string, string>) {
  const entries = Object.entries(source);
  return {
    get length() {
      return entries.length;
    },
    key(index: number) {
      return entries[index]?.[0] ?? null;
    },
    getItem(key: string) {
      return source[key] ?? null;
    },
  };
}

function runProbeScript(
  script: string,
  snapshots: {
    localStorage?: Record<string, string>;
    sessionStorage?: Record<string, string>;
  },
) {
  const evaluator = new Function(
    'window',
    `return ${script.trim()};`,
  ) as (window: {
    localStorage: ReturnType<typeof createWebStorage>;
    sessionStorage: ReturnType<typeof createWebStorage>;
  }) => unknown;

  return evaluator({
    localStorage: createWebStorage(snapshots.localStorage ?? {}),
    sessionStorage: createWebStorage(snapshots.sessionStorage ?? {}),
  });
}

function createSigninPreviewWindowMock() {
  const children: unknown[] = [];
  return {
    isDestroyed: () => false,
    isVisible: () => true,
    focus: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    getContentBounds: () => ({ width: 1280, height: 860 }),
    removeAllListeners: vi.fn(),
    on: vi.fn(),
    contentView: {
      children,
      addChildView: vi.fn((view: unknown) => {
        children.push(view);
      }),
      removeChildView: vi.fn((view: unknown) => {
        const index = children.indexOf(view);
        if (index >= 0) {
          children.splice(index, 1);
        }
      }),
    },
  };
}

function createDebuggerMock(options: {
  responseUrl: string;
  responseBody: unknown;
}) {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const emit = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) {
      listener(...args);
    }
  };

  return {
    isAttached: vi.fn(() => false),
    attach: vi.fn(),
    detach: vi.fn(),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      current.push(listener);
      listeners.set(event, current);
    }),
    off: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      listeners.set(
        event,
        current.filter((item) => item !== listener),
      );
    }),
    sendCommand: vi.fn(async (method: string) => {
      if (method === 'Network.enable') {
        queueMicrotask(() => {
          emit(
            'message',
            {},
            'Network.responseReceived',
            {
              requestId: 'request-1',
              response: {
                url: options.responseUrl,
              },
            },
          );
        });
        return {};
      }

      if (method === 'Network.getResponseBody') {
        return {
          base64Encoded: false,
          body: JSON.stringify(options.responseBody),
        };
      }

      return {};
    }),
  };
}

const mockDbGetTasks = vi.fn(() => []);
const mockDbGetTaskFlow = vi.fn((taskId: string) => buildGenericTaskFlow(taskId));
const mockDbSaveTaskFlow = vi.fn((flow) => flow);
const mockDbUpdateTaskStatus = vi.fn();
const mockLogInfo = vi.fn();
const mockLogWarn = vi.fn();
const mockLogError = vi.fn();
const mockLogWrite = vi.fn();
const mockLogExport = vi.fn(() => 'debug-package');
const mockLogQueryMcpAudit = vi.fn(() => [
  {
    timestamp: '2026-04-20T10:00:00.000Z',
    level: 'info',
    source: 'main',
    message: 'MCP audit',
    data: { action: 'task.run', taskId: 'task-1' },
  },
]);
const mockLogClose = vi.fn();
const mockTrayCreate = vi.fn();
const mockTrayDestroy = vi.fn();
const mockCheckForUpdates = vi.fn();
const mockShowOpenDialog = vi.hoisted(() => vi.fn());
const mockCreateTab = vi.fn(() => ({ webContents: { id: 1 } }));
const mockGetOrCreateTabBySession = vi.fn();
const mockCloseTab = vi.fn();
const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockGoForward = vi.fn();
const mockReload = vi.fn();
const mockPluginLoadAll = vi.fn();
const mockPluginGetAll = vi.fn(() => [
  {
    manifest: {
      name: 'test-plugin',
      version: '1.0.0',
      displayName: 'Test Plugin',
      description: '测试插件',
      main: 'index.js',
      permissions: ['ui'],
      permissionLevel: 1,
      engines: { yclaw: '>=1.0.0' },
    },
    status: 'installed',
    path: 'C:\\plugins\\test-plugin',
  },
]);
const mockPluginGet = vi.fn(() => ({
  manifest: {
    name: 'test-plugin',
    version: '1.0.0',
    displayName: 'Test Plugin',
    description: '测试插件',
    main: 'index.js',
    permissions: ['ui'],
    permissionLevel: 1,
    engines: { yclaw: '>=1.0.0' },
  },
  status: 'installed',
  path: 'C:\\plugins\\test-plugin',
}));
const mockPluginInstallFromPath = vi.fn(async () => ({
  name: 'danger-plugin',
  permissions: ['network'],
  level: 2,
  requiresConfirmation: true,
}));
const mockPluginConfirmPendingInstall = vi.fn(async () => ({
  manifest: {
    name: 'danger-plugin',
    version: '1.0.0',
    displayName: 'Danger Plugin',
    description: '高权限测试插件',
    main: 'index.js',
    permissions: ['network'],
    permissionLevel: 2,
    engines: { yclaw: '>=1.0.0' },
  },
  status: 'installed',
  path: 'C:\\plugins\\danger-plugin',
}));
const mockPluginActivate = vi.fn();
const mockPluginDeactivate = vi.fn();
const mockPluginUninstall = vi.fn();
const mockAiChat = vi.fn(async () => ({
  conversationId: 'conv-1',
  message: {
    id: 'msg-1',
    role: 'assistant',
    content: '测试回复',
    timestamp: Date.now(),
  },
}));
const mockAiGetConfig = vi.fn(() => ({ provider: 'openai', model: 'gpt-3.5-turbo' }));
const mockAiUpdateConfig = vi.fn();
const mockAiListTools = vi.fn(() => []);
const mockAiExecuteTool = vi.fn(async () => ({ success: true, data: { ok: true } }));
const mockAiListConversations = vi.fn(() => []);
const mockAiDeleteConversation = vi.fn(() => true);
const mockCollectAiContext = vi.fn(async () => ({
  currentModule: 'workbench',
  systemMetrics: { cpu: 0, memory: 0, disk: 0, uptime: 0 },
  recentTasks: [],
  installedPlugins: [],
}));
const mockMcpClientManagerSyncServers = vi.fn(async () => undefined);
const mockMcpClientManagerClose = vi.fn(async () => undefined);
const mockMcpClientManagerGetServerStatuses = vi.fn(() => []);
const mockSessionList = vi.fn(() => []);
const mockSessionCreate = vi.fn();
const mockSessionDelete = vi.fn();
const mockSessionBindTask = vi.fn();
const mockTemplateList = vi.fn(() => []);
const mockTemplateSave = vi.fn();
const mockTemplateDelete = vi.fn();
const mockAlertAggregate = vi.fn(() => []);
const mockAlertList = vi.fn(() => []);
const mockAlertDismiss = vi.fn();
const mockResultList = vi.fn(() => []);
const mockResultGet = vi.fn(() => null);
const mockResultExport = vi.fn(() => 'results.csv');
const mockResultMarkSuspicious = vi.fn();
const mockExecutionLogQuery = vi.fn(() => []);
const mockIndicatorCalculate = vi.fn(() => ({ type: 'MA', values: [1, 2, 3] }));
const mockSchedulerStart = vi.fn();
const mockSchedulerStop = vi.fn();
const mockSchedulerStatus = vi.fn(() => ({
  runningCount: 0,
  queuedCount: 0,
  scheduledCount: 1,
}));
const mockStartEmbeddedMcpHttpServer = vi.hoisted(() =>
  vi.fn(async ({ host = '127.0.0.1', port = 0 } = {}) => ({
    running: true,
    host,
    port: port || 3940,
    endpoint: `http://${host}:${port || 3940}/mcp`,
    transport: 'http',
    mode: 'streamable-http',
    authRequired: true,
    close: vi.fn(async () => undefined),
  })),
);
const mockFeatureListPackages = vi.fn(() => [
  {
    id: 'stock',
    module: 'stock',
    displayName: '股票分析',
    version: '1.0.0',
    installed: false,
  },
]);
const mockFeatureInstallPackage = vi.fn(async () => ({
  id: 'stock',
  module: 'stock',
  version: '1.0.0',
  installed: true,
  entryPath: 'C:\\Users\\Admin\\AppData\\Roaming\\YClaw\\features\\stock\\renderer\\entries\\stock\\index.html',
}));
const defaultConfigGet = (key: string) => {
  if (key === 'ai') {
    return { provider: 'openai', model: 'gpt-3.5-turbo' };
  }
  if (key === 'modules') {
    return {};
  }
  return undefined;
};
const mockConfigGet = vi.fn(defaultConfigGet);
const mockConfigGetGeneral = vi.fn(() => ({
  theme: 'system',
  language: 'zh-CN',
  startupBehavior: 'showWorkbench',
  closeToTray: false,
}));

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'YClaw'),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
  },
  dialog: {
    showOpenDialog: mockShowOpenDialog,
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: MockIpcHandler) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
  },
}));

vi.mock('@main/windows/WindowManager', () => ({
  WindowManager: vi.fn().mockImplementation(() => ({
    openWindow: mockOpenWindow,
    getWindow: mockGetWindow,
    getOpenModules: mockGetOpenModules,
    closeWindow: mockCloseWindow,
    closeAll: mockCloseAllWindows,
  })),
}));

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    open: mockOpenDb,
    close: mockCloseDb,
    all: mockDbAll,
    get: mockDbGet,
    run: mockDbRun,
    transaction: mockDbTransaction,
    getTasks: mockDbGetTasks,
    getTaskFlow: mockDbGetTaskFlow,
    saveTaskFlow: mockDbSaveTaskFlow,
    updateTaskStatus: mockDbUpdateTaskStatus,
  })),
}));

vi.mock('@main/services/ConfigService', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    get: mockConfigGet,
    getGeneral: mockConfigGetGeneral,
    set: vi.fn(),
    getAll: vi.fn(() => ({ general: {}, modules: {}, plugins: {} })),
    reset: vi.fn(),
    exportConfig: vi.fn(() => '{}'),
    importConfig: vi.fn(),
  })),
}));

vi.mock('@main/services/LogService', () => ({
  LogService: vi.fn().mockImplementation(() => ({
    info: mockLogInfo,
    warn: mockLogWarn,
    error: mockLogError,
    write: mockLogWrite,
    exportDebugPackage: mockLogExport,
    queryMcpAudit: mockLogQueryMcpAudit,
    close: mockLogClose,
  })),
}));

vi.mock('@main/services/TrayService', () => ({
  TrayService: vi.fn().mockImplementation(() => ({
    create: mockTrayCreate,
    destroy: mockTrayDestroy,
  })),
}));

vi.mock('@main/services/UpdateService', () => ({
  UpdateService: vi.fn().mockImplementation(() => ({
    checkForUpdates: mockCheckForUpdates,
  })),
}));

vi.mock('@main/services/FeaturePackageService', () => ({
  FeaturePackageService: vi.fn().mockImplementation(() => ({
    listPackages: mockFeatureListPackages,
    installPackage: mockFeatureInstallPackage,
    getInstalledEntryPath: vi.fn(() => null),
    resolveRendererUrl: vi.fn(() => null),
  })),
}));

vi.mock('@main/browser/TabManager', () => ({
  TabManager: vi.fn().mockImplementation(() => ({
    createTab: mockCreateTab,
    getOrCreateTabBySession: mockGetOrCreateTabBySession,
    closeTab: mockCloseTab,
    navigate: mockNavigate,
    goBack: mockGoBack,
    goForward: mockGoForward,
    reload: mockReload,
    closeAll: vi.fn(),
  })),
}));

vi.mock('@main/ai/AIService', () => ({
  AIService: vi.fn().mockImplementation(() => ({
    chat: mockAiChat,
    getConfig: mockAiGetConfig,
    updateConfig: mockAiUpdateConfig,
    getToolRegistry: vi.fn(() => ({
      list: mockAiListTools,
      execute: mockAiExecuteTool,
    })),
    getContextManager: vi.fn(() => ({
      collectContext: mockCollectAiContext,
    })),
    listConversations: mockAiListConversations,
    deleteConversation: mockAiDeleteConversation,
  })),
}));

vi.mock('@mcp/client/McpClientManager', () => ({
  McpClientManager: vi.fn().mockImplementation(() => ({
    syncServers: mockMcpClientManagerSyncServers,
    close: mockMcpClientManagerClose,
    getServerStatuses: mockMcpClientManagerGetServerStatuses,
  })),
}));

vi.mock('@main/services/SessionRegistry', () => ({
  SessionRegistry: vi.fn().mockImplementation(() => ({
    listSessions: mockSessionList,
    createSession: mockSessionCreate,
    deleteSession: mockSessionDelete,
    bindTaskSession: mockSessionBindTask,
  })),
}));

vi.mock('@main/services/TemplateService', () => ({
  TemplateService: vi.fn().mockImplementation(() => ({
    listTemplates: mockTemplateList,
    saveTemplate: mockTemplateSave,
    deleteTemplate: mockTemplateDelete,
  })),
}));

vi.mock('@main/services/AlertService', () => ({
  AlertService: vi.fn().mockImplementation(() => ({
    aggregateFromExecutionLogs: mockAlertAggregate,
    listAlerts: mockAlertList,
    dismissAlert: mockAlertDismiss,
  })),
}));

vi.mock('@main/services/ResultService', () => ({
  ResultService: vi.fn().mockImplementation(() => ({
    listResults: mockResultList,
    getResult: mockResultGet,
    exportResults: mockResultExport,
    markSuspicious: mockResultMarkSuspicious,
  })),
}));

vi.mock('@main/services/ExecutionLogService', () => ({
  ExecutionLogService: vi.fn().mockImplementation(() => ({
    query: mockExecutionLogQuery,
  })),
}));

vi.mock('@main/plugin-loader/PluginLoader', () => ({
  PluginLoader: vi.fn().mockImplementation(() => ({
    loadAll: mockPluginLoadAll,
    getAll: mockPluginGetAll,
    get: mockPluginGet,
    installFromPath: mockPluginInstallFromPath,
    confirmPendingInstall: mockPluginConfirmPendingInstall,
    activate: mockPluginActivate,
    deactivate: mockPluginDeactivate,
    uninstall: mockPluginUninstall,
  })),
}));

vi.mock('@main/services/SchedulerService', () => ({
  SchedulerService: vi.fn().mockImplementation(() => ({
    start: mockSchedulerStart,
    stop: mockSchedulerStop,
    getStatus: mockSchedulerStatus,
  })),
}));

vi.mock('@engines/analytics/IndicatorLibrary', () => ({
  IndicatorLibrary: vi.fn().mockImplementation(() => ({
    calculate: mockIndicatorCalculate,
  })),
}));

vi.mock('@mcp/server/startEmbeddedHttpServer', () => ({
  startEmbeddedMcpHttpServer: mockStartEmbeddedMcpHttpServer,
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

import { App } from '@main/app';

describe('App IPC integration', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    mockConfigGet.mockImplementation(defaultConfigGet);

    const existingTaskIds = new Set(['task-1']);

    mockDbAll.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM task_steps')) {
        const taskId = String(params?.[0] ?? '');
        const flow = mockDbGetTaskFlow(taskId);
        return (flow?.steps ?? []).map((step: { id: string; name: string; action: unknown; retryCount?: number; retryDelay?: number }) => ({
          id: step.id,
          name: step.name,
          actionJson: JSON.stringify(step.action),
          retryCount: step.retryCount ?? 3,
          retryDelay: step.retryDelay ?? 1000,
        }));
      }

      if (sql.includes('FROM tasks')) {
        return mockDbGetTasks();
      }

      return [];
    });

    mockDbGet.mockImplementation((sql: string, params?: unknown[]) => {
      if (!sql.includes('FROM tasks')) {
        return undefined;
      }

      const taskId = String(params?.[0] ?? '');
      const flow = mockDbGetTaskFlow(taskId);
      if (!flow) {
        return undefined;
      }

      return {
        id: flow.id,
        name: flow.name,
        description: flow.description ?? null,
        flowJson: JSON.stringify({
          steps: flow.steps,
          entryUrl: flow.entryUrl,
          kind: flow.kind,
          signin: flow.signin ?? null,
        }),
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
        sessionId: flow.sessionId ?? null,
      };
    });

    mockDbRun.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('UPDATE tasks') && Array.isArray(params) && params.length === 4) {
        const [name, description, flowJson, taskId] = params as [string, string | null, string, string];
        const parsed = JSON.parse(flowJson) as { steps: unknown[] };
        mockDbSaveTaskFlow({
          id: taskId,
          name,
          description: description ?? undefined,
          steps: parsed.steps,
        });
        return { changes: existingTaskIds.has(taskId) ? 1 : 0 };
      }

      if (sql.includes('INSERT INTO tasks') && Array.isArray(params) && params.length >= 6) {
        existingTaskIds.add(String(params[0]));
        return { changes: 1 };
      }

      if (sql.includes('UPDATE tasks') && Array.isArray(params) && params.length === 2) {
        mockDbUpdateTaskStatus(params[1], params[0]);
        return { changes: 1 };
      }

      return { changes: 1 };
    });
  });

  it('registers the required P0 channels on start', async () => {
    const app = new App();

    await app.start();

    expect(Array.from(handlers.keys())).toEqual(
      expect.arrayContaining([
        IPC_CHANNELS.AI_CHAT,
        IPC_CHANNELS.FEATURE_PACKAGE_INSTALL,
        IPC_CHANNELS.FEATURE_PACKAGE_LIST,
        IPC_CHANNELS.PLUGIN_LIST,
        IPC_CHANNELS.TASK_LIST,
        IPC_CHANNELS.STOCK_DATA,
      ]),
    );
    expect(mockPluginLoadAll).toHaveBeenCalled();
  });

  it('injects explicit AI repositories and context when constructing AIService', () => {
    new App();

    expect(AIService).toHaveBeenCalledWith(
      expect.objectContaining({
        taskRepository: expect.objectContaining({
          getTasks: expect.any(Function),
        }),
        aiRepository: expect.objectContaining({
          saveAIConversation: expect.any(Function),
          saveAIMessage: expect.any(Function),
          deleteAIConversation: expect.any(Function),
        }),
        contextManager: expect.objectContaining({
          collectContext: expect.any(Function),
          contextToPrompt: expect.any(Function),
        }),
      }),
    );
  });

  it('injects explicit repositories when constructing app services', () => {
    new App();

    expect(SessionRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionRepository: expect.objectContaining({
          createSession: expect.any(Function),
          listSessions: expect.any(Function),
          bindTaskSession: expect.any(Function),
          deleteSession: expect.any(Function),
        }),
      }),
    );
    expect(TemplateService).toHaveBeenCalledWith(
      expect.objectContaining({
        templateRepository: expect.objectContaining({
          saveTemplate: expect.any(Function),
          listTemplates: expect.any(Function),
          deleteTemplate: expect.any(Function),
          attachTemplateToTask: expect.any(Function),
        }),
      }),
    );
    expect(AlertService).toHaveBeenCalledWith(
      expect.objectContaining({
        alertRepository: expect.objectContaining({
          listAlerts: expect.any(Function),
          pushAlert: expect.any(Function),
          dismissAlert: expect.any(Function),
        }),
        executionLogService: expect.objectContaining({
          query: expect.any(Function),
        }),
      }),
    );
    expect(ResultService).toHaveBeenCalledWith(
      expect.objectContaining({
        resultRepository: expect.objectContaining({
          saveResult: expect.any(Function),
          listResults: expect.any(Function),
          getResult: expect.any(Function),
          markSuspicious: expect.any(Function),
        }),
      }),
    );
    expect(ExecutionLogService).toHaveBeenCalledWith(
      expect.objectContaining({
        executionLogRepository: expect.objectContaining({
          append: expect.any(Function),
          query: expect.any(Function),
        }),
      }),
    );
  });

  it('returns the loaded plugin registry through plugin:list', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.PLUGIN_LIST);
    expect(handler).toBeDefined();

    const response = await handler!({});
    expect(response).toMatchObject({
      success: true,
      data: [
        {
          manifest: { name: 'test-plugin' },
          status: 'installed',
        },
      ],
    });
  });

  it('opens local picker and returns pending confirmation for high-permission plugin install', async () => {
    mockShowOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['C:\\local-plugins\\danger-plugin'],
    });
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.PLUGIN_INSTALL);
    expect(handler).toBeDefined();

    const response = await handler!({}, { source: 'local' });
    expect(mockShowOpenDialog).toHaveBeenCalled();
    expect(mockPluginInstallFromPath).toHaveBeenCalledWith('C:\\local-plugins\\danger-plugin');
    expect(response).toMatchObject({
      success: true,
      data: {
        name: 'danger-plugin',
        requiresConfirmation: true,
      },
    });
  });

  it('confirms a pending high-permission plugin install', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.PLUGIN_PERMISSION_CHECK);
    expect(handler).toBeDefined();

    const response = await handler!({}, { name: 'danger-plugin', confirmed: true });
    expect(mockPluginConfirmPendingInstall).toHaveBeenCalledWith('danger-plugin', true);
    expect(response).toMatchObject({
      success: true,
      data: {
        manifest: { name: 'danger-plugin' },
      },
    });
  });

  it('requires explicit confirmation before uninstalling a plugin', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.PLUGIN_UNINSTALL);
    expect(handler).toBeDefined();

    const rejected = await handler!({}, { name: 'test-plugin' });
    expect(rejected).toMatchObject({
      success: false,
      error: {
        code: 'HANDLER_ERROR',
      },
    });
    expect(mockPluginUninstall).not.toHaveBeenCalled();

    const accepted = await handler!({}, { name: 'test-plugin', confirmed: true });
    expect(mockPluginUninstall).toHaveBeenCalledWith('test-plugin');
    expect(accepted).toMatchObject({
      success: true,
      data: { name: 'test-plugin', status: 'uninstalled' },
    });
  });

  it('returns a structured ai:chat response through ipcMain handler', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.AI_CHAT);
    expect(handler).toBeDefined();

    const response = await handler!({}, { message: '你好' });
    expect(response).toMatchObject({
      success: true,
      data: {
        conversationId: expect.any(String),
        message: {
          role: 'assistant',
          content: expect.any(String),
        },
      },
    });
  });

  it('returns scheduler status through ipcMain handler', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.SCHEDULER_STATUS);
    expect(handler).toBeDefined();

    const response = await handler!({});
    expect(mockSchedulerStatus).toHaveBeenCalled();
    expect(response).toMatchObject({
      success: true,
      data: {
        runningCount: 0,
        queuedCount: 0,
        scheduledCount: 1,
      },
    });
  });

  it('returns feature package catalog through ipcMain handler', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.FEATURE_PACKAGE_LIST);
    expect(handler).toBeDefined();

    const response = await handler!({});
    expect(mockFeatureListPackages).toHaveBeenCalled();
    expect(response).toMatchObject({
      success: true,
      data: [
        {
          id: 'stock',
          installed: false,
        },
      ],
    });
  });

  it('installs a feature package through ipcMain handler', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.FEATURE_PACKAGE_INSTALL);
    expect(handler).toBeDefined();

    const response = await handler!({}, { id: 'stock' });
    expect(mockFeatureInstallPackage).toHaveBeenCalledWith('stock');
    expect(response).toMatchObject({
      success: true,
      data: {
        id: 'stock',
        installed: true,
      },
    });
  });

  it('starts and stops embedded MCP HTTP server through ipc handlers', async () => {
    const app = new App();

    await app.start();

    const startHandler = handlers.get(IPC_CHANNELS.AI_MCP_START);
    const statusHandler = handlers.get(IPC_CHANNELS.AI_MCP_STATUS);
    const stopHandler = handlers.get(IPC_CHANNELS.AI_MCP_STOP);

    expect(startHandler).toBeDefined();
    expect(statusHandler).toBeDefined();
    expect(stopHandler).toBeDefined();

    const started = await startHandler!({}, { host: '127.0.0.1', port: 0 });
    expect(mockStartEmbeddedMcpHttpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        createServer: expect.any(Function),
        host: '127.0.0.1',
        port: 0,
        token: undefined,
        logService: expect.any(Object),
      }),
    );
    expect(started).toMatchObject({
      success: true,
      data: {
        running: true,
        transport: 'http',
        mode: 'streamable-http',
      },
    });

    const status = await statusHandler!({});
    expect(status).toMatchObject({
      success: true,
      data: {
        running: true,
        endpoint: expect.stringContaining('/mcp'),
        authRequired: true,
      },
    });

    const stopped = await stopHandler!({});
    expect(stopped).toMatchObject({
      success: true,
      data: {
        running: false,
      },
    });
  });

  it('uses persisted MCP HTTP config when ipc start params omit values', async () => {
    mockConfigGet.mockImplementation((key: string) => {
      if (key === 'ai') {
        return {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          mcp: {
            embeddedHttp: {
              host: '127.0.0.1',
              port: 4949,
              token: 'persisted-token',
            },
          },
        };
      }
      if (key === 'modules') {
        return {};
      }
      return undefined;
    });

    const app = new App();

    await app.start();

    const startHandler = handlers.get(IPC_CHANNELS.AI_MCP_START);
    expect(startHandler).toBeDefined();

    await startHandler!({}, {});

    expect(mockStartEmbeddedMcpHttpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '127.0.0.1',
        port: 4949,
        token: 'persisted-token',
      }),
    );
  });

  it('deep merges MCP config when updating AI settings', async () => {
    mockConfigGet.mockImplementation((key: string) => {
      if (key === 'ai') {
        return {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          mcp: {
            embeddedHttp: {
              host: '127.0.0.1',
              port: 3939,
              token: 'persisted-token',
            },
            servers: [],
          },
        };
      }
      if (key === 'modules') {
        return {};
      }
      return undefined;
    });

    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.AI_CONFIG_SET);
    expect(handler).toBeDefined();

    const response = await handler!({}, {
      mcp: {
        servers: [
          {
            id: 'git',
            name: 'Git',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-git'],
            env: { GIT_ROOT: 'E:\\allsite\\yclaw' },
            enabled: true,
          },
        ],
      },
    });

    expect(mockAiUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        mcp: {
          embeddedHttp: {
            host: '127.0.0.1',
            port: 3939,
            token: 'persisted-token',
          },
          servers: [
            expect.objectContaining({
              id: 'git',
              command: 'npx',
            }),
          ],
        },
      }),
    );
    expect(response).toMatchObject({
      success: true,
      data: {
        mcp: {
          embeddedHttp: {
            host: '127.0.0.1',
            port: 3939,
            token: 'persisted-token',
          },
          servers: [
            {
              id: 'git',
              name: 'Git',
              command: 'npx',
            },
          ],
        },
      },
    });
  });

  it('syncs external MCP servers on app start and config update', async () => {
    mockConfigGet.mockImplementation((key: string) => {
      if (key === 'ai') {
        return {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          mcp: {
            servers: [
              {
                id: 'git',
                name: 'Git',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-git'],
                enabled: true,
              },
            ],
          },
        };
      }
      if (key === 'modules') {
        return {};
      }
      return undefined;
    });

    const app = new App();
    await app.start();

    expect(mockMcpClientManagerSyncServers).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'git',
        command: 'npx',
      }),
    ]);

    const handler = handlers.get(IPC_CHANNELS.AI_CONFIG_SET);
    expect(handler).toBeDefined();

    await handler!({}, {
      mcp: {
        servers: [
          {
            id: 'fs',
            name: 'Filesystem',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', 'E:\\allsite\\yclaw'],
            enabled: true,
          },
        ],
      },
    });

    expect(mockMcpClientManagerSyncServers).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: 'fs',
        command: 'npx',
      }),
    ]);
  });

  it('returns external MCP server availability through ipc handler', async () => {
    mockMcpClientManagerGetServerStatuses.mockReturnValueOnce([
      {
        id: 'filesystem',
        name: 'Filesystem',
        enabled: true,
        connected: false,
        state: 'unavailable',
        toolCount: 0,
        lastError: 'spawn failed',
      },
    ]);

    const app = new App();
    await app.start();

    const handler = handlers.get(IPC_CHANNELS.AI_MCP_CLIENT_STATUS);
    expect(handler).toBeDefined();

    const response = await handler!({});

    expect(response).toMatchObject({
      success: true,
      data: [
        {
          id: 'filesystem',
          state: 'unavailable',
          lastError: 'spawn failed',
        },
      ],
    });
  });

  it('returns MCP audit entries through ipc handler', async () => {
    const app = new App();
    await app.start();

    const handler = handlers.get(IPC_CHANNELS.AI_MCP_AUDIT_LIST);
    expect(handler).toBeDefined();

    const response = await handler!({}, { limit: 5 });

    expect(mockLogQueryMcpAudit).toHaveBeenCalledWith(5);
    expect(response).toMatchObject({
      success: true,
      data: [
        {
          message: 'MCP audit',
          data: {
            action: 'task.run',
            taskId: 'task-1',
          },
        },
      ],
    });
  });

  it('executes AI tools through ipc with collected context', async () => {
    const app = new App();
    await app.start();

    const handler = handlers.get(IPC_CHANNELS.AI_TOOL_EXECUTE);
    expect(handler).toBeDefined();

    const response = await handler!({}, {
      name: 'mcp.mock.echo',
      params: {
        text: 'hello',
      },
    });

    expect(mockCollectAiContext).toHaveBeenCalled();
    expect(mockAiExecuteTool).toHaveBeenCalledWith(
      'mcp.mock.echo',
      {
        text: 'hello',
      },
      expect.objectContaining({
        currentModule: 'workbench',
      }),
    );
    expect(response).toMatchObject({
      success: true,
      data: {
        success: true,
        data: {
          ok: true,
        },
      },
    });
  });

  it('returns persisted task flow details through task:get', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.TASK_GET);
    expect(handler).toBeDefined();

    const response = await handler!({}, { taskId: 'task-1' });
    expect(mockDbGetTaskFlow).toHaveBeenCalledWith('task-1');
    expect(response).toMatchObject({
      success: true,
      data: {
        id: 'task-1',
        steps: [
          {
            id: 'step-1',
          },
        ],
      },
    });
  });

  it('persists updated task steps through task:save', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.TASK_SAVE);
    expect(handler).toBeDefined();

    const response = await handler!({}, {
      taskId: 'task-1',
      steps: [
        {
          id: 'step-1',
          name: '打开页面',
          action: { type: 'click', selector: '#open' },
        },
        {
          id: 'step-2',
          name: '采集价格',
          action: { type: 'extract', selector: '.price' },
        },
      ],
    });
    expect(mockDbSaveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        steps: expect.arrayContaining([
          expect.objectContaining({ id: 'step-2' }),
        ]),
      }),
    );
    expect(response).toMatchObject({
      success: true,
      data: {
        id: 'task-1',
        steps: expect.arrayContaining([
          expect.objectContaining({ id: 'step-2' }),
        ]),
      },
    });
  });

  it('persists updated task name through task:save', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.TASK_SAVE);
    expect(handler).toBeDefined();

    const response = await handler!({}, {
      taskId: 'task-1',
      name: '价格采集任务',
      steps: [
        {
          id: 'step-1',
          name: '打开页面',
          action: { type: 'click', selector: '#open' },
        },
      ],
    });

    expect(mockDbSaveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        name: '价格采集任务',
      }),
    );
    expect(response).toMatchObject({
      success: true,
      data: {
        id: 'task-1',
        name: '价格采集任务',
      },
    });
  });

  it('creates a new task through task:save when taskId is missing', async () => {
    const app = new App();

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.TASK_SAVE);
    expect(handler).toBeDefined();

    const response = await handler!({}, {
      steps: [
        {
          id: 'step-new-1',
          name: '打开首页',
          action: { type: 'click', selector: '#home' },
        },
      ],
    });

    expect(mockDbSaveTaskFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: '未命名任务',
        steps: expect.arrayContaining([
          expect.objectContaining({ id: 'step-new-1' }),
        ]),
      }),
    );
    expect(response).toMatchObject({
      success: true,
      data: {
        id: expect.any(String),
        name: '未命名任务',
      },
    });
  });

  it('captures signin token from sessionStorage fallback entries and closes the preview window', async () => {
    mockSessionList.mockReturnValueOnce([
      {
        id: 'session-signin-1',
        name: '阿里云盘账号',
        domain: 'aliyundrive.com',
        partition: 'persist:session_signin_1',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      },
    ]);
    mockDbGetTaskFlow.mockImplementation((taskId: string) =>
      taskId === 'task-signin-1' ? buildSigninTaskFlow(taskId) : buildGenericTaskFlow(taskId),
    );

    const view = {
      setBounds: vi.fn(),
      webContents: {
        id: 77,
        isDestroyed: () => false,
        loadURL: vi.fn(async () => undefined),
        executeJavaScript: vi.fn(async (script: string) =>
          runProbeScript(script, {
            localStorage: {
              theme: 'light',
            },
            sessionStorage: {
              authSnapshot: JSON.stringify({
                refresh_token: 'rt-session-storage',
                access_token: 'at-session-storage',
                user_name: '测试账号',
                user_id: 'uid-session',
                default_drive_id: 'drive-session',
                expire_time: '2026-05-01T00:00:00.000Z',
                token_type: 'Bearer',
              }),
            },
          }),
        ),
      },
    };
    mockGetOrCreateTabBySession.mockReturnValueOnce(view);

    const app = new App();
    const previewWindow = createSigninPreviewWindowMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).signinPreviewWindow = previewWindow;

    await app.start();

    const handler = handlers.get(IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE);
    expect(handler).toBeDefined();

    const response = await handler!({}, { taskId: 'task-signin-1' });

    expect(mockGetOrCreateTabBySession).toHaveBeenCalledWith(
      'persist:session_signin_1',
      'https://www.aliyundrive.com/sign/in',
    );
    expect(view.webContents.loadURL).toHaveBeenCalledWith('https://www.aliyundrive.com/sign/in');
    expect(response).toMatchObject({
      success: true,
      data: {
        refreshToken: 'rt-session-storage',
        accessToken: 'at-session-storage',
        userName: '测试账号',
        userId: 'uid-session',
        defaultDriveId: 'drive-session',
        tokenType: 'Bearer',
        timedOut: false,
      },
    });
    expect(previewWindow.close).toHaveBeenCalledTimes(1);
  });

  it('captures signin token from auth response body when storage does not expose it', async () => {
    vi.useFakeTimers();
    try {
      mockSessionList.mockReturnValueOnce([
        {
          id: 'session-signin-1',
          name: '阿里云盘账号',
          domain: 'aliyundrive.com',
          partition: 'persist:session_signin_1',
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        },
      ]);
      mockDbGetTaskFlow.mockImplementation((taskId: string) =>
        taskId === 'task-signin-1' ? buildSigninTaskFlow(taskId) : buildGenericTaskFlow(taskId),
      );

      const debuggerMock = createDebuggerMock({
        responseUrl: 'https://passport.aliyundrive.com/newlogin/login.do?appName=aliyun',
        responseBody: {
          content: {
            data: {
              bizExt: JSON.stringify({
                pds_login_result: {
                  refreshToken: 'rt-network',
                  accessToken: 'at-network',
                  userName: '网络账号',
                  userId: 'uid-network',
                  defaultDriveId: 'drive-network',
                  tokenType: 'Bearer',
                },
              }),
            },
          },
        },
      });
      const view = {
        setBounds: vi.fn(),
        webContents: {
          id: 78,
          debugger: debuggerMock,
          isDestroyed: () => false,
          loadURL: vi.fn(async () => undefined),
          executeJavaScript: vi.fn(async () => null),
        },
      };
      mockGetOrCreateTabBySession.mockReturnValueOnce(view);

      const app = new App();
      const previewWindow = createSigninPreviewWindowMock();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).signinPreviewWindow = previewWindow;

      await app.start();

      const handler = handlers.get(IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE);
      expect(handler).toBeDefined();

      const responsePromise = handler!({}, { taskId: 'task-signin-1' });
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 2000);
      const response = await responsePromise;

      expect(response).toMatchObject({
        success: true,
        data: {
          refreshToken: 'rt-network',
          accessToken: 'at-network',
          userName: '网络账号',
          userId: 'uid-network',
          defaultDriveId: 'drive-network',
          tokenType: 'Bearer',
          timedOut: false,
        },
      });
      expect(previewWindow.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes signin preview window during shutdown', () => {
    const app = new App();
    const close = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).signinPreviewWindow = {
      isDestroyed: () => false,
      close,
    };

    app.shutdown();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
