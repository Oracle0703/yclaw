import { app, BrowserWindow } from 'electron';
import { WindowManager } from './windows/WindowManager';
import { IpcController } from './ipc/IpcController';
import { EventBus } from './ipc/EventBus';
import { DatabaseService } from './services/DatabaseService';
import { ConfigService } from './services/ConfigService';
import { LogService } from './services/LogService';
import { TrayService } from './services/TrayService';
import { UpdateService } from './services/UpdateService';
import { TabManager } from './browser/TabManager';
import { IPC_CHANNELS } from '@shared/constants';

/**
 * 应用生命周期管理
 */
export class App {
  private windowManager: WindowManager;
  private ipcController: IpcController;
  private eventBus: EventBus;
  private databaseService: DatabaseService;
  private configService: ConfigService;
  private logService: LogService;
  private trayService: TrayService;
  private updateService: UpdateService;
  private tabManager: TabManager;
  private started = false;

  constructor() {
    this.windowManager = new WindowManager();
    this.ipcController = new IpcController();
    this.eventBus = EventBus.getInstance();
    this.databaseService = new DatabaseService();
    this.configService = new ConfigService();
    this.logService = new LogService();
    this.trayService = new TrayService(this.windowManager);
    this.updateService = new UpdateService(this.logService);
    this.tabManager = new TabManager();
  }

  async start(): Promise<void> {
    if (this.started) {
      if (!this.windowManager.getWindow('workbench')) {
        this.windowManager.openWindow({ module: 'workbench' });
      }
      return;
    }

    // 初始化数据库
    this.databaseService.open();
    this.logService.info('main', 'Application starting...');

    // 注册 IPC handlers
    this.registerIpcHandlers();

    // 创建系统托盘
    this.trayService.create();

    // 创建主窗口
    this.windowManager.openWindow({ module: 'workbench' });

    this.started = true;
    this.logService.info('main', 'Application started successfully');
  }

  private registerIpcHandlers(): void {
    // 窗口管理
    this.ipcController.handle(IPC_CHANNELS.WINDOW_OPEN, (params: unknown) => {
      const { module, options } = params as { module: string; options?: Record<string, number> };
      this.windowManager.openWindow({ module, options });
      return { module };
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_CLOSE, (module: unknown) => {
      if (typeof module === 'string' && module.length > 0) {
        this.windowManager.closeWindow(module);
      } else {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.close();
      }
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.minimize();
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_LIST, () => {
      return this.windowManager.getOpenModules();
    });

    // 配置
    this.ipcController.handle(IPC_CHANNELS.CONFIG_GET, (key: unknown) => {
      return this.configService.get(key as keyof ReturnType<ConfigService['getAll']>);
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_SET, (params: unknown) => {
      const { key, value } = params as { key: string; value: unknown };
      this.configService.set(key as 'general', value as never);
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_GET_ALL, () => {
      return this.configService.getAll();
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_RESET, () => {
      this.configService.reset();
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_EXPORT, () => {
      return this.configService.exportConfig();
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_IMPORT, (jsonString: unknown) => {
      this.configService.importConfig(jsonString as string);
    });

    // 日志
    this.ipcController.handle(IPC_CHANNELS.LOG_WRITE, (params: unknown) => {
      const { level, source, message, data } = params as {
        level: 'debug' | 'info' | 'warn' | 'error';
        source: 'main' | 'renderer' | 'plugin' | 'engine';
        message: string;
        data?: unknown;
      };
      this.logService.write(level, source, message, data);
    });

    this.ipcController.handle(IPC_CHANNELS.LOG_EXPORT, () => {
      return this.logService.exportDebugPackage();
    });

    // 应用信息
    this.ipcController.handle(IPC_CHANNELS.APP_INFO, () => {
      return {
        version: app.getVersion(),
        name: app.getName(),
        platform: process.platform,
        electron: process.versions.electron,
        node: process.versions.node,
      };
    });

    // 检查更新
    this.ipcController.handle(IPC_CHANNELS.APP_CHECK_UPDATE, async () => {
      await this.updateService.checkForUpdates();
    });

    // 浏览器标签页
    this.ipcController.handle(IPC_CHANNELS.BROWSER_CREATE_TAB, (params: unknown) => {
      const { url } = (params as { url?: string }) ?? {};
      const view = this.tabManager.createTab(url);
      return { id: view.webContents.id };
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_CLOSE_TAB, (params: unknown) => {
      const { id } = params as { id: number };
      this.tabManager.closeTab(id);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_NAVIGATE, (params: unknown) => {
      const { tabId, url } = params as { tabId: number; url: string };
      this.tabManager.navigate(url, tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_GO_BACK, (params: unknown) => {
      const { tabId } = params as { tabId?: number };
      this.tabManager.goBack(tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_GO_FORWARD, (params: unknown) => {
      const { tabId } = params as { tabId?: number };
      this.tabManager.goForward(tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_RELOAD, (params: unknown) => {
      const { tabId } = params as { tabId?: number };
      this.tabManager.reload(tabId);
    });
  }

  shutdown(): void {
    this.logService.info('main', 'Application shutting down...');
    this.started = false;
    this.ipcController.dispose();
    this.databaseService.close();
    this.logService.close();
    this.trayService.destroy();
    this.tabManager.closeAll();
    this.windowManager.closeAll();
  }
}
