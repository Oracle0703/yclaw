import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginLoader } from '@main/plugin-loader/PluginLoader';
import { WindowManager } from '@main/windows/WindowManager';
import { ConfigService } from '@main/services/ConfigService';
import { FeaturePackageService } from '@main/services/FeaturePackageService';
import { TabManager } from '@main/browser/TabManager';
import { SchedulerService } from '@main/services/SchedulerService';
import { TaskService } from '@main/services/TaskService';
import { TrayService } from '@main/services/TrayService';
import { UpdateService } from '@main/services/UpdateService';
import { DataSourceManager } from '@engines/analytics/DataSourceManager';
import { AIService } from '@main/ai/AIService';

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

vi.mock('@main/windows/WindowManager', () => ({
  WindowManager: vi.fn().mockImplementation(() => ({
    openWindow: vi.fn(),
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
    getTasks: vi.fn(() => []),
    getTaskFlow: vi.fn(),
    saveTaskFlow: vi.fn(),
    updateTaskStatus: vi.fn(),
  })),
}));

vi.mock('@main/services/ConfigService', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    get: vi.fn((key: string) => (key === 'ai' ? { provider: 'openai', model: 'gpt-3.5-turbo' } : {})),
    getGeneral: vi.fn(() => ({ closeToTray: false })),
  })),
}));

vi.mock('@main/services/LogService', () => ({
  LogService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/TrayService', () => ({
  TrayService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/UpdateService', () => ({
  UpdateService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/FeaturePackageService', () => ({
  FeaturePackageService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/browser/TabManager', () => ({
  TabManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/ai/AIService', () => ({
  AIService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/plugin-loader/PluginLoader', () => ({
  PluginLoader: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/plugin-loader/PermissionChecker', () => ({
  PermissionChecker: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/TaskService', () => ({
  TaskService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/SchedulerService', () => ({
  SchedulerService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/SessionRegistry', () => ({
  SessionRegistry: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/TemplateService', () => ({
  TemplateService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/ExecutionLogService', () => ({
  ExecutionLogService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/AlertService', () => ({
  AlertService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/ResultService', () => ({
  ResultService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@engines/analytics/DataSourceManager', () => ({
  DataSourceManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@engines/analytics/IndicatorLibrary', () => ({
  IndicatorLibrary: vi.fn().mockImplementation(() => ({})),
}));

import { App } from '@main/app';

describe('App composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects explicit task repository when constructing TaskService', () => {
    new App();

    expect(TaskService).toHaveBeenCalledWith(
      expect.objectContaining({
        batchService: expect.any(Object),
        createRunner: expect.any(Function),
        eventBus: expect.any(Object),
        taskRepository: expect.any(Object),
      }),
    );
  });

  it('injects explicit task service when constructing SchedulerService', () => {
    new App();

    expect(SchedulerService).toHaveBeenCalledWith(
      expect.objectContaining({
        taskService: expect.any(Object),
      }),
    );
  });

  it('injects explicit config service when constructing FeaturePackageService', () => {
    new App();

    expect(FeaturePackageService).toHaveBeenCalledWith(
      expect.objectContaining({
        configService: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing TabManager', () => {
    new App();

    expect(TabManager).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing WindowManager', () => {
    new App();

    expect(WindowManager).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing PluginLoader', () => {
    new App();

    expect(PluginLoader).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
        permissionChecker: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing ConfigService', () => {
    new App();

    expect(ConfigService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing TrayService', () => {
    new App();

    expect(TrayService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
        windowManager: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing UpdateService', () => {
    new App();

    expect(UpdateService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
        logService: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing DataSourceManager', () => {
    new App();

    expect(DataSourceManager).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('injects explicit tool registry when constructing AIService', () => {
    new App();

    expect(AIService).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRepository: expect.any(Object),
        contextManager: expect.any(Object),
        taskRepository: expect.any(Object),
        toolRegistry: expect.any(Object),
      }),
    );
  });
});
