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
  options?: Partial<WindowState>;
}

/**
 * 窗口管理器 — 管理所有模块窗口的创建、销毁、状态记忆
 */
export class WindowManager {
  private windows = new Map<string, BrowserWindow>();
  private windowStates = new Map<string, WindowState>();
  private eventBus: EventBus;
  private readonly maxWindows = 10;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  private getPreloadPath(): string {
    return process.env.ELECTRON_PRELOAD_PATH ?? path.join(__dirname, 'preload.js');
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * 创建或聚焦模块窗口
   */
  openWindow(config: WindowConfig): BrowserWindow {
    const { module, options } = config;

    // 检查是否已存在
    const existing = this.windows.get(module);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    // 窗口数量限制
    if (this.windows.size >= this.maxWindows) {
      throw new Error(`Maximum window limit (${this.maxWindows}) reached`);
    }

    // 恢复上次窗口状态
    const savedState = this.windowStates.get(module);
    const defaultState: WindowState = {
      width: options?.width ?? savedState?.width ?? 1200,
      height: options?.height ?? savedState?.height ?? 800,
      x: options?.x ?? savedState?.x,
      y: options?.y ?? savedState?.y,
    };

    const win = new BrowserWindow({
      ...defaultState,
      minWidth: 600,
      minHeight: 400,
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

    if (this.isDevelopment()) {
      win.webContents.openDevTools({ mode: 'detach' });
      this.attachDevDebugListeners(win, module);
    }

    // 保存窗口状态
    win.on('close', () => {
      const bounds = win.getBounds();
      this.windowStates.set(module, {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: win.isMaximized(),
      });
    });

    win.on('closed', () => {
      this.windows.delete(module);
      this.eventBus.emit(EVENTS.MODULE_CLOSED, { module });
    });

    this.windows.set(module, win);
    this.eventBus.emit(EVENTS.MODULE_OPENED, { module });

    return win;
  }

  /**
   * 关闭指定模块窗口
   */
  closeWindow(module: string): void {
    const win = this.windows.get(module);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }

  /**
   * 获取指定模块窗口
   */
  getWindow(module: string): BrowserWindow | undefined {
    const win = this.windows.get(module);
    return win && !win.isDestroyed() ? win : undefined;
  }

  /**
   * 获取所有打开的模块列表
   */
  getOpenModules(): string[] {
    return Array.from(this.windows.entries())
      .filter(([_, win]) => !win.isDestroyed())
      .map(([module]) => module);
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
