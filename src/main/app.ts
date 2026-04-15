import { app, BrowserWindow, dialog } from 'electron';
import type { WebContents } from 'electron';
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
import { AIService } from './ai/AIService';
import { PluginLoader } from './plugin-loader/PluginLoader';
import { PermissionChecker } from './plugin-loader/PermissionChecker';
import { TaskService } from './services/TaskService';
import { DataSourceManager } from '@engines/analytics/DataSourceManager';
import { IndicatorLibrary } from '@engines/analytics/IndicatorLibrary';
import { EVENTS } from '@shared/constants';
import type {
  AIChatRequest,
  AIConfig,
  OHLCVData,
  IndicatorType,
  DataSourceConfig,
} from '@shared/types';

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
  private aiService: AIService;
  private pluginLoader: PluginLoader;
  private permissionChecker: PermissionChecker;
  private taskService: TaskService;
  private dataSourceManager: DataSourceManager;
  private indicatorLibrary: IndicatorLibrary;
  private eventForwarders: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];
  private started = false;

  constructor() {
    this.configService = new ConfigService();
    this.windowManager = new WindowManager({
      shouldCloseToTray: () => this.configService.getGeneral().closeToTray,
    });
    this.ipcController = new IpcController();
    this.eventBus = EventBus.getInstance();
    this.databaseService = new DatabaseService();
    this.logService = new LogService();
    this.trayService = new TrayService(this.windowManager);
    this.updateService = new UpdateService(this.logService);
    this.tabManager = new TabManager({
      sessionPartition: this.getBrowserSessionPartition(),
    });
    this.aiService = new AIService({
      config: this.configService.get('ai'),
      openWindow: (module: string) => this.windowManager.openWindow({ module }),
    });
    this.pluginLoader = new PluginLoader();
    this.permissionChecker = new PermissionChecker();
    this.taskService = new TaskService({ databaseService: this.databaseService });
    this.dataSourceManager = new DataSourceManager();
    this.indicatorLibrary = new IndicatorLibrary();
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
    await this.pluginLoader.loadAll();
    this.logService.info('main', 'Application starting...');

    // 注册 IPC handlers
    this.registerIpcHandlers();
    this.registerEventForwarders();

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
      const validKeys = ['general', 'modules', 'plugins', 'ai'] as const;
      if (typeof key !== 'string' || !validKeys.includes(key as (typeof validKeys)[number])) {
        throw new Error(
          `Invalid config key: ${String(key)}. Expected one of: ${validKeys.join(', ')}`,
        );
      }
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

    // AI 助手
    this.ipcController.handle(IPC_CHANNELS.AI_CHAT, async (request: unknown) => {
      return this.aiService.chat(request as AIChatRequest);
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONFIG_GET, () => {
      return this.configService.get('ai');
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONFIG_SET, (config: unknown) => {
      const nextConfig = { ...this.configService.get('ai'), ...(config as Partial<AIConfig>) };
      this.configService.set('ai', nextConfig);
      this.aiService.updateConfig(nextConfig);
      return nextConfig;
    });

    this.ipcController.handle(IPC_CHANNELS.AI_TOOLS_LIST, () => {
      return this.aiService.getToolRegistry().list();
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONVERSATION_LIST, () => {
      return this.aiService.listConversations();
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONVERSATION_DELETE, (id: unknown) => {
      return this.aiService.deleteConversation(String(id));
    });

    // 插件
    this.ipcController.handle(IPC_CHANNELS.PLUGIN_LIST, () => {
      return this.pluginLoader.getAll();
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_INSTALL, async (params: unknown) => {
      const { source, path: pluginPath } =
        (params as {
          source?: 'local';
          path?: string;
        }) ?? {};

      if (source !== 'local') {
        throw new Error('Only local plugin installation is supported in this version');
      }

      const selectedPath = pluginPath ?? (await this.pickLocalPluginPath());
      if (!selectedPath) {
        return null;
      }

      return this.pluginLoader.installFromPath(selectedPath);
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_PERMISSION_CHECK, (params: unknown) => {
      const { name, confirmed } = params as { name: string; confirmed: boolean };
      return this.pluginLoader.confirmPendingInstall(name, confirmed);
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_ENABLE, (params: unknown) => {
      const { name } = params as { name: string };
      this.pluginLoader.activate(name);
      return { name, status: 'active' };
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_DISABLE, (params: unknown) => {
      const { name } = params as { name: string };
      this.pluginLoader.deactivate(name);
      return { name, status: 'inactive' };
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_UNINSTALL, (params: unknown) => {
      const { name, confirmed } = params as { name: string; confirmed?: boolean };
      const plugin = this.pluginLoader.get(name);
      if (!plugin) {
        throw new Error(`Plugin "${name}" not found`);
      }
      if (this.permissionChecker.requiresUninstallConfirmation(plugin.manifest) && !confirmed) {
        throw new Error(`Uninstalling plugin "${name}" requires confirmation`);
      }
      this.pluginLoader.uninstall(name);
      return { name, status: 'uninstalled' };
    });

    // 任务
    this.ipcController.handle(IPC_CHANNELS.TASK_LIST, () => {
      return this.taskService.listTasks();
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_START, (params: unknown) => {
      const { taskId, tabId } = params as { taskId: string; tabId?: number };
      const webContents = this.getTaskWebContents(tabId);
      return this.taskService.startTask(taskId, webContents);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_PAUSE, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.pauseTask(taskId);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_RESUME, (params: unknown) => {
      const { taskId, tabId } = params as { taskId: string; tabId?: number };
      const webContents = this.getTaskWebContents(tabId);
      return this.taskService.resumeTask(taskId, webContents);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_STOP, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.stopTask(taskId);
    });

    // 股票
    this.ipcController.handle(IPC_CHANNELS.STOCK_DATA, (params: unknown) => {
      const { symbol, timeframe, sourceConfig } =
        (params as {
          symbol?: string;
          timeframe?: string;
          sourceConfig?: DataSourceConfig;
        }) ?? {};
      return this.getStockHistory({
        symbol: symbol ?? 'AAPL',
        timeframe: timeframe ?? '1D',
        sourceConfig,
      });
    });

    this.ipcController.handle(IPC_CHANNELS.STOCK_INDICATOR_CALC, (params: unknown) => {
      const { type, data, options } = params as {
        type: IndicatorType;
        data: OHLCVData[];
        options?: Record<string, number>;
      };
      return this.indicatorLibrary.calculate(type, data, options);
    });

    // 浏览器标签页
    this.ipcController.handle(IPC_CHANNELS.BROWSER_CREATE_TAB, (params: unknown) => {
      const { url } = (params as { url?: string }) ?? {};
      const view = this.tabManager.createTab(url);
      const tabInfo = this.tabManager.getTabInfo(view.webContents.id);
      if (!tabInfo) {
        throw new Error('Failed to create browser tab');
      }
      return tabInfo;
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_CLOSE_TAB, (params: unknown) => {
      const { id } = params as { id: number };
      this.tabManager.closeTab(id);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_LIST_TABS, () => {
      return this.tabManager.getAllTabs();
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
    for (const { event, listener } of this.eventForwarders) {
      this.eventBus.off(event, listener);
    }
    this.eventForwarders = [];
    this.ipcController.dispose();
    this.dataSourceManager.closeAll();
    this.databaseService.close();
    this.logService.close();
    this.trayService.destroy();
    this.tabManager.closeAll();
    this.windowManager.closeAll();
  }

  private createMockStockHistory(symbol: string): OHLCVData[] {
    const data: OHLCVData[] = [];
    const baseTime = Date.now() - 29 * 24 * 60 * 60 * 1000;
    let lastClose = symbol === 'TSLA' ? 180 : 100;

    for (let index = 0; index < 30; index++) {
      const open = lastClose;
      const drift = Math.sin(index / 3) * 2 + index * 0.15;
      const close = Number((open + drift).toFixed(2));
      const high = Number((Math.max(open, close) + 1.8).toFixed(2));
      const low = Number((Math.min(open, close) - 1.5).toFixed(2));
      const volume = 100000 + index * 2500;

      data.push({
        time: baseTime + index * 24 * 60 * 60 * 1000,
        open: Number(open.toFixed(2)),
        high,
        low,
        close,
        volume,
      });

      lastClose = close;
    }

    return data;
  }

  private registerEventForwarders(): void {
    if (this.eventForwarders.length > 0) {
      return;
    }

    const eventsToForward = [
      EVENTS.TASK_STARTED,
      EVENTS.TASK_STEP_COMPLETED,
      EVENTS.TASK_COMPLETED,
      EVENTS.TASK_FAILED,
      EVENTS.TASK_PAUSED,
      EVENTS.TASK_STATUS_CHANGED,
      EVENTS.STOCK_DATA_UPDATE,
      EVENTS.STOCK_REALTIME_TICK,
    ];

    this.eventForwarders = eventsToForward.map((event) => {
      const listener = (payload: unknown) => {
        this.windowManager.broadcast(event, payload);
      };
      this.eventBus.on(event, listener);
      return { event, listener };
    });
  }

  private async getStockHistory(params: {
    symbol: string;
    timeframe: string;
    sourceConfig?: DataSourceConfig;
  }): Promise<OHLCVData[]> {
    const { symbol, timeframe, sourceConfig } = params;
    let data: OHLCVData[];
    let source: 'demo' | 'live';

    if (sourceConfig) {
      data = await this.dataSourceManager.fetchHistory(sourceConfig, symbol, {
        interval: timeframe,
      });
      source = 'live';
    } else {
      data = this.createMockStockHistory(symbol);
      source = 'demo';
    }

    this.eventBus.emit(EVENTS.STOCK_DATA_UPDATE, {
      symbol,
      timeframe,
      source,
      data,
    });

    return data;
  }

  private async pickLocalPluginPath(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: '选择本地插件目录',
      buttonLabel: '安装插件',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  private getBrowserSessionPartition(): string | undefined {
    const browserConfig = this.configService.get('modules').browser;
    const configuredPartition = browserConfig?.settings?.sessionPartition;
    return typeof configuredPartition === 'string' && configuredPartition.trim().length > 0
      ? configuredPartition.trim()
      : undefined;
  }

  private getTaskWebContents(tabId?: number): WebContents {
    const view = this.tabManager.getView(tabId);
    if (!view) {
      throw new Error('No active browser tab available for task execution');
    }
    return view.webContents;
  }
}
