import { BrowserWindow } from 'electron';
import path from 'path';
import { EventBus } from '../ipc/EventBus';
import { EVENTS } from '@shared/constants';
import { getRendererUrl } from '../utils/paths';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

interface WindowConfig {
  module: string;
  instanceId?: string;
  options?: Partial<WindowState>;
}

interface WindowManagerOptions {
  shouldCloseToTray?: () => boolean;
}

/**
 * 窗口管理器 — 管理所有模块窗口的创建、销毁、状态记忆
 */
export class WindowManager {
  private windows = new Map<string, BrowserWindow>();
  private windowStates = new Map<string, WindowState>();
  private readyWindows = new Set<string>();
  private eventBus: EventBus;
  private readonly maxWindows = 10;
  private readonly shouldCloseToTray: () => boolean;
  private allowWindowClose = false;

  constructor(options: WindowManagerOptions = {}) {
    this.eventBus = EventBus.getInstance();
    this.shouldCloseToTray = options.shouldCloseToTray ?? (() => false);
  }

  private getPreloadPath(): string {
    return process.env.ELECTRON_PRELOAD_PATH ?? path.join(__dirname, 'preload.js');
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private shouldOpenDevTools(): boolean {
    return this.isDevelopment();
  }

  /**
   * 创建或聚焦模块窗口
   */
  openWindow(config: WindowConfig): BrowserWindow {
    const windowKey = this.getWindowKey(config.module, config.instanceId);
    const existing = this.windows.get(windowKey);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) {
        existing.restore();
      }
      if (this.readyWindows.has(windowKey)) {
        existing.show();
        existing.focus();
      } else {
        existing.once('ready-to-show', () => {
          if (!existing.isDestroyed()) {
            existing.show();
            existing.focus();
          }
        });
      }
      return existing;
    }

    return this.ensureWindow(config, false);
  }

  preloadWindow(config: WindowConfig): BrowserWindow {
    const windowKey = this.getWindowKey(config.module, config.instanceId);
    const existing = this.windows.get(windowKey);
    if (existing && !existing.isDestroyed()) {
      return existing;
    }

    return this.ensureWindow(config, true);
  }

  private ensureWindow(config: WindowConfig, hidden: boolean): BrowserWindow {
    const { module, instanceId, options } = config;
    const windowKey = this.getWindowKey(module, instanceId);

    if (this.windows.size >= this.maxWindows) {
      throw new Error(`Maximum window limit (${this.maxWindows}) reached`);
    }

    const savedState = this.windowStates.get(windowKey);
    const defaultState: WindowState = {
      width: options?.width ?? savedState?.width ?? 1200,
      height: options?.height ?? savedState?.height ?? 800,
      x: options?.x ?? savedState?.x,
      y: options?.y ?? savedState?.y,
    };

    const win = this.createWindow(windowKey, module, defaultState, hidden, instanceId);
    this.windows.set(windowKey, win);
    this.eventBus.emit(EVENTS.MODULE_OPENED, { module, instanceId });

    return win;
  }

  private createWindow(
    windowKey: string,
    module: string,
    defaultState: WindowState,
    hidden: boolean,
    instanceId?: string,
  ): BrowserWindow {
    const win = new BrowserWindow({
      ...defaultState,
      show: false,
      backgroundColor: '#0b1220',
      minWidth: 600,
      minHeight: 400,
      frame: false, 
      title: `YClaw - ${module}`,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // 加载入口 URL
    const url = getRendererUrl(module);
    win.loadURL(url);

    // 等待首次渲染完成后再显示，消除白屏闪烁
    win.once('ready-to-show', () => {
      this.readyWindows.add(windowKey);
      if (!hidden) {
        win.show();
      }
    });

    if (this.shouldOpenDevTools() && !hidden) {
      win.webContents.openDevTools({ mode: 'detach' });
      this.attachDevDebugListeners(win, module);
    }
    // 保存窗口状态
    win.on('close', (event) => {
      if (module === 'workbench' && this.shouldCloseToTray() && !this.allowWindowClose) {
        event.preventDefault();
        win.hide();
        return;
      }

      const bounds = win.getBounds();
      this.windowStates.set(windowKey, {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: win.isMaximized(),
      });
    });

    win.on('closed', () => {
      this.windows.delete(windowKey);
      this.readyWindows.delete(windowKey);
      this.eventBus.emit(EVENTS.MODULE_CLOSED, { module, instanceId });
    });

    return win;
  }

  /**
   * 关闭指定模块窗口
   */
  closeWindow(module: string, instanceId?: string): void {
    const win = this.getWindow(module, instanceId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }

  /**
   * 获取指定模块窗口
   */
  getWindow(module: string, instanceId?: string): BrowserWindow | undefined {
    const win = instanceId
      ? this.windows.get(this.getWindowKey(module, instanceId))
      : this.findWindowByModule(module);
    return win && !win.isDestroyed() ? win : undefined;
  }

  /**
   * 获取所有打开的模块列表
   */
  getOpenModules(): string[] {
    const result = new Set<string>();
    for (const [windowKey, win] of this.windows) {
      if (!win.isDestroyed()) {
        result.add(this.getModuleFromWindowKey(windowKey));
      }
    }
    return Array.from(result);
  }

  /**
   * 向指定窗口发送消息
   */
  sendToWindow(module: string, channel: string, ...args: unknown[]): void {
    const win = this.getWindow(module);
    if (win) {
      win.webContents.send(channel, ...args);
    }
  }

  /**
   * 向所有窗口广播消息
   */
  broadcast(channel: string, ...args: unknown[]): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    }
  }

  /**
   * 关闭所有窗口
   */
  closeAll(): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  }

  allowQuit(): void {
    this.allowWindowClose = true;
  }

  private getWindowKey(module: string, instanceId?: string): string {
    return instanceId ? `${module}:${instanceId}` : module;
  }

  private getModuleFromWindowKey(windowKey: string): string {
    return windowKey.split(':')[0];
  }

  private findWindowByModule(module: string): BrowserWindow | undefined {
    const exact = this.windows.get(module);
    if (exact && !exact.isDestroyed()) {
      return exact;
    }

    for (const [windowKey, win] of this.windows) {
      if (this.getModuleFromWindowKey(windowKey) === module && !win.isDestroyed()) {
        return win;
      }
    }

    return undefined;
  }

  private attachDevDebugListeners(win: BrowserWindow, module: string): void {
    win.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        console.error('[window] did-fail-load', {
          module,
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
        });
      },
    );

    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log('[renderer]', { module, level, message, line, sourceId });
    });

    win.webContents.on('did-finish-load', () => {
      console.log('[window] did-finish-load', { module, url: win.webContents.getURL() });
    });

    win.webContents.on('render-process-gone', (_event, details) => {
      console.error('[window] render-process-gone', { module, details });
    });
  }
}
