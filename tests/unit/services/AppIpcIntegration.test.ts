import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';

type MockIpcHandler = (...args: unknown[]) => unknown | Promise<unknown>;

const handlers = new Map<string, MockIpcHandler>();
const mockOpenWindow = vi.fn();
const mockGetWindow = vi.fn();
const mockGetOpenModules = vi.fn(() => ['workbench']);
const mockCloseWindow = vi.fn();
const mockCloseAllWindows = vi.fn();
const mockOpenDb = vi.fn();
const mockCloseDb = vi.fn();
const mockDbGetTasks = vi.fn(() => []);
const mockDbGetTaskFlow = vi.fn((taskId: string) => ({
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
}));
const mockDbSaveTaskFlow = vi.fn((flow) => flow);
const mockDbUpdateTaskStatus = vi.fn();
const mockLogInfo = vi.fn();
const mockLogWrite = vi.fn();
const mockLogExport = vi.fn(() => 'debug-package');
const mockLogClose = vi.fn();
const mockTrayCreate = vi.fn();
const mockTrayDestroy = vi.fn();
const mockCheckForUpdates = vi.fn();
const mockShowOpenDialog = vi.hoisted(() => vi.fn());
const mockCreateTab = vi.fn(() => ({ webContents: { id: 1 } }));
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
const mockAiListConversations = vi.fn(() => []);
const mockAiDeleteConversation = vi.fn(() => true);
const mockIndicatorCalculate = vi.fn(() => ({ type: 'MA', values: [1, 2, 3] }));
const mockConfigGet = vi.fn((key: string) => {
  if (key === 'ai') {
    return { provider: 'openai', model: 'gpt-3.5-turbo' };
  }
  if (key === 'modules') {
    return {};
  }
  return undefined;
});
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
    write: mockLogWrite,
    exportDebugPackage: mockLogExport,
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

vi.mock('@main/browser/TabManager', () => ({
  TabManager: vi.fn().mockImplementation(() => ({
    createTab: mockCreateTab,
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
    })),
    listConversations: mockAiListConversations,
    deleteConversation: mockAiDeleteConversation,
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

vi.mock('@engines/analytics/IndicatorLibrary', () => ({
  IndicatorLibrary: vi.fn().mockImplementation(() => ({
    calculate: mockIndicatorCalculate,
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

import { App } from '@main/app';

describe('App IPC integration', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
  });

  it('registers the required P0 channels on start', async () => {
    const app = new App();

    await app.start();

    expect(Array.from(handlers.keys())).toEqual(
      expect.arrayContaining([
        IPC_CHANNELS.AI_CHAT,
        IPC_CHANNELS.PLUGIN_LIST,
        IPC_CHANNELS.TASK_LIST,
        IPC_CHANNELS.STOCK_DATA,
      ]),
    );
    expect(mockPluginLoadAll).toHaveBeenCalled();
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
});
