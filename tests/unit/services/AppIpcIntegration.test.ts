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
const mockLogInfo = vi.fn();
const mockLogWrite = vi.fn();
const mockLogExport = vi.fn(() => 'debug-package');
const mockLogClose = vi.fn();
const mockTrayCreate = vi.fn();
const mockTrayDestroy = vi.fn();
const mockCheckForUpdates = vi.fn();
const mockCreateTab = vi.fn(() => ({ webContents: { id: 1 } }));
const mockCloseTab = vi.fn();
const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockGoForward = vi.fn();
const mockReload = vi.fn();
const mockPluginLoadAll = vi.fn();
const mockPluginGetAll = vi.fn(() => []);
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

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'YClaw'),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
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
  })),
}));

vi.mock('@main/services/ConfigService', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
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
});
