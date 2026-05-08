import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => {
  type Listener = (...args: unknown[]) => void;
  type ListenerMap = Map<string, Listener[]>;
  interface MockWindowOptions {
    width?: number;
    height?: number;
  }
  interface MockWindow {
    _options: MockWindowOptions;
    _destroyed: boolean;
    _listeners: ListenerMap;
    isDestroyed: () => boolean;
    isMaximized: () => boolean;
    isMinimized: () => boolean;
    restore: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    getBounds: () => { x: number; y: number; width: number; height: number };
    loadURL: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    webContents: typeof webContentsMock;
  }
  const webContentsMock = {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn((_event: string, listener: Listener) => {
      // 立即同步触发，模拟首次 did-finish-load 已经完成
      queueMicrotask(() => listener());
    }),
    getURL: vi.fn(() => 'http://localhost:5173/mock/'),
    openDevTools: vi.fn(),
  };
  const createBrowserWindow = (opts: MockWindowOptions): MockWindow => {
    const win: MockWindow = {
      _options: opts,
      _destroyed: false,
      _listeners: new Map<string, Listener[]>(),
      isDestroyed: () => win._destroyed,
      isMaximized: () => false,
      isMinimized: () => false,
      restore: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(() => {
        let prevented = false;
        const event = {
          preventDefault: () => {
            prevented = true;
          },
        };
        const closeListeners = win._listeners.get('close') ?? [];
        closeListeners.forEach((fn) => fn(event));
        if (prevented) return;
        win._destroyed = true;
        const closedListeners = win._listeners.get('closed') ?? [];
        closedListeners.forEach((fn) => fn());
      }),
      getBounds: () => ({ x: 100, y: 100, width: opts.width ?? 1200, height: opts.height ?? 800 }),
      loadURL: vi.fn(() => {
        // Simulate ready-to-show firing after page load
        queueMicrotask(() => {
          const handlers = [...(win._listeners.get('ready-to-show') ?? [])];
          handlers.forEach((fn) => fn());
          win._listeners.set('ready-to-show', []);
        });
      }),
      on: vi.fn((event: string, listener: Listener) => {
        const list = win._listeners.get(event) ?? [];
        list.push(listener);
        win._listeners.set(event, list);
      }),
      once: vi.fn((event: string, listener: Listener) => {
        const wrapper = (...args: unknown[]) => {
          const list = win._listeners.get(event) ?? [];
          const idx = list.indexOf(wrapper);
          if (idx >= 0) list.splice(idx, 1);
          listener(...args);
        };
        const list = win._listeners.get(event) ?? [];
        list.push(wrapper);
        win._listeners.set(event, list);
      }),
      webContents: webContentsMock,
    };
    return win;
  };
  return {
    BrowserWindow: vi.fn(createBrowserWindow),
  };
});

// Mock paths
vi.mock('@main/utils/paths', () => ({
  getRendererUrl: (module: string) => `http://localhost:5173/${module}/`,
}));

import { WindowManager } from '@main/windows/WindowManager';

describe('WindowManager', () => {
  let manager: WindowManager;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  const mockEventBus = {
    emit: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    off: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'development';
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    manager = new WindowManager({ eventBus: mockEventBus as never });
  });

  it('should require event bus injection', () => {
    expect(() => new WindowManager()).toThrowError('eventBus is required');
  });

  it('should create a new window for a non-builtin module', async () => {
    const win = manager.openWindow({ module: 'custom-mod' });
    expect(win).toBeDefined();
    expect(win.loadURL).toHaveBeenCalledWith('http://localhost:5173/custom-mod/');
    // Wait for ready-to-show microtask
    await Promise.resolve();
    expect(win.show).toHaveBeenCalled();
  });

  it('should focus existing window instead of creating duplicate', async () => {
    const win1 = manager.openWindow({ module: 'custom-mod' });
    await Promise.resolve(); // ready-to-show fires
    const win2 = manager.openWindow({ module: 'custom-mod' });
    expect(win1).toBe(win2);
    expect(win1.focus).toHaveBeenCalled();
  });

  it('routes builtin module openWindow into the workbench window', async () => {
    const win1 = manager.openWindow({ module: 'workbench' });
    await Promise.resolve();
    const win2 = manager.openWindow({ module: 'stock' });
    expect(win2).toBe(win1);
    // 不应再为 stock 创建独立 BrowserWindow
    expect(manager.getOpenModules()).not.toContain('stock');
    // 会向 workbench webContents 发送 APP_NAVIGATE，把 module 信息带过去
    expect(win1.webContents.send).toHaveBeenCalledWith('app:navigate', { module: 'stock' });
  });

  it('routes hot monitor module openWindow into the workbench window', async () => {
    const win1 = manager.openWindow({ module: 'workbench' });
    await Promise.resolve();
    const win2 = manager.openWindow({ module: 'hot-monitor' });

    expect(win2).toBe(win1);
    expect(manager.getOpenModules()).not.toContain('hot-monitor');
    expect(win1.webContents.send).toHaveBeenCalledWith('app:navigate', {
      module: 'hot-monitor',
    });
  });

  it('routes comment monitor module openWindow into the workbench window', async () => {
    const win1 = manager.openWindow({ module: 'workbench' });
    await Promise.resolve();
    const win2 = manager.openWindow({ module: 'comment-monitor' });

    expect(win2).toBe(win1);
    expect(manager.getOpenModules()).not.toContain('comment-monitor');
    expect(win1.webContents.send).toHaveBeenCalledWith('app:navigate', {
      module: 'comment-monitor',
    });
  });

  it('should create distinct windows for the same module when instanceId differs', () => {
    const win1 = manager.openWindow({ module: 'custom-mod', instanceId: 'left' });
    const win2 = manager.openWindow({ module: 'custom-mod', instanceId: 'right' });
    expect(win1).not.toBe(win2);
    expect(manager.getWindow('custom-mod', 'left')).toBe(win1);
    expect(manager.getWindow('custom-mod', 'right')).toBe(win2);
  });

  it('should hide the workbench instead of closing when closeToTray is enabled', () => {
    manager = new WindowManager({ shouldCloseToTray: () => true, eventBus: mockEventBus as never });
    const win = manager.openWindow({ module: 'workbench' });
    manager.closeWindow('workbench');
    expect(win.hide).toHaveBeenCalled();
    expect(manager.getWindow('workbench')).toBe(win);
  });

  it('should track open modules', () => {
    manager.openWindow({ module: 'custom-a' });
    manager.openWindow({ module: 'custom-b' });
    const modules = manager.getOpenModules();
    expect(modules).toContain('custom-a');
    expect(modules).toContain('custom-b');
  });

  it('should enforce max window limit', () => {
    for (let i = 0; i < 10; i++) {
      manager.openWindow({ module: `module-${i}` });
    }
    expect(() => manager.openWindow({ module: 'module-10' })).toThrow('Maximum window limit');
  });

  it('should get a specific window', () => {
    manager.openWindow({ module: 'custom-mod' });
    const win = manager.getWindow('custom-mod');
    expect(win).toBeDefined();
  });

  it('should return undefined for non-existent window', () => {
    expect(manager.getWindow('nonexistent')).toBeUndefined();
  });

  it('should close a specific window', () => {
    const win = manager.openWindow({ module: 'custom-mod' });
    manager.closeWindow('custom-mod');
    expect(win.close).toHaveBeenCalled();
  });

  it('should apply custom options', () => {
    const win = manager.openWindow({
      module: 'custom-mod',
      options: { width: 1600, height: 900 },
    });
    expect(win._options.width).toBe(1600);
    expect(win._options.height).toBe(900);
  });

  it('should send messages to specific window', () => {
    const win = manager.openWindow({ module: 'custom-mod' });
    manager.sendToWindow('custom-mod', 'test:channel', { data: 1 });
    expect(win.webContents.send).toHaveBeenCalledWith('test:channel', { data: 1 });
  });

  it('should broadcast to all windows', () => {
    const win1 = manager.openWindow({ module: 'custom-a' });
    const win2 = manager.openWindow({ module: 'custom-b' });
    manager.broadcast('update:config', 'payload');
    expect(win1.webContents.send).toHaveBeenCalledWith('update:config', 'payload');
    expect(win2.webContents.send).toHaveBeenCalledWith('update:config', 'payload');
  });

  it('should close all windows', () => {
    const win1 = manager.openWindow({ module: 'custom-a' });
    const win2 = manager.openWindow({ module: 'custom-b' });
    manager.closeAll();
    expect(win1.close).toHaveBeenCalled();
    expect(win2.close).toHaveBeenCalled();
  });

  it('should log only window failures in development debug listeners', () => {
    const win = manager.openWindow({ module: 'custom-mod' });

    expect(win.webContents.on).toHaveBeenCalledWith('did-fail-load', expect.any(Function));
    expect(win.webContents.on).toHaveBeenCalledWith('render-process-gone', expect.any(Function));
    expect(win.webContents.on).not.toHaveBeenCalledWith('did-finish-load', expect.any(Function));
    expect(win.webContents.on).not.toHaveBeenCalledWith('console-message', expect.any(Function));

    const didFailLoadHandler = vi
      .mocked(win.webContents.on)
      .mock.calls.find(([event]) => event === 'did-fail-load')?.[1] as
      | ((
          event: unknown,
          errorCode: number,
          errorDescription: string,
          validatedURL: string,
          isMainFrame: boolean,
        ) => void)
      | undefined;

    didFailLoadHandler?.(undefined, -2, 'ERR_FAILED', 'https://example.com', true);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[window] did-fail-load', {
      module: 'custom-mod',
      errorCode: -2,
      errorDescription: 'ERR_FAILED',
      validatedURL: 'https://example.com',
      isMainFrame: true,
    });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
