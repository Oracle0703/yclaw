import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => {
  const webContentsMock = {
    send: vi.fn(),
  };
  const createBrowserWindow = (opts: any) => {
    const win: any = {
      _options: opts,
      _destroyed: false,
      _listeners: new Map<string, Function[]>(),
      isDestroyed: () => win._destroyed,
      isMaximized: () => false,
      isMinimized: () => false,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(() => {
        const closeListeners = win._listeners.get('close') ?? [];
        closeListeners.forEach((fn: Function) => fn());
        const closedListeners = win._listeners.get('closed') ?? [];
        closedListeners.forEach((fn: Function) => fn());
      }),
      getBounds: () => ({ x: 100, y: 100, width: opts.width ?? 1200, height: opts.height ?? 800 }),
      loadURL: vi.fn(() => {
        // Simulate ready-to-show firing after page load
        queueMicrotask(() => {
          const handlers = win._listeners.get('ready-to-show') ?? [];
          handlers.forEach((fn: Function) => fn());
          win._listeners.set('ready-to-show', []);
        });
      }),
      on: vi.fn((event: string, listener: Function) => {
        const list = win._listeners.get(event) ?? [];
        list.push(listener);
        win._listeners.set(event, list);
      }),
      once: vi.fn((event: string, listener: Function) => {
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

// Mock EventBus
vi.mock('@main/ipc/EventBus', () => {
  const emitFn = vi.fn().mockReturnValue(true);
  return {
    EventBus: {
      getInstance: () => ({
        emit: emitFn,
        on: vi.fn(),
        off: vi.fn(),
      }),
    },
  };
});

import { WindowManager } from '@main/windows/WindowManager';

describe('WindowManager', () => {
  let manager: WindowManager;

  beforeEach(() => {
    manager = new WindowManager();
  });

  it('should create a new window for a module', async () => {
    const win = manager.openWindow({ module: 'stock' });
    expect(win).toBeDefined();
    expect(win.loadURL).toHaveBeenCalledWith('http://localhost:5173/stock/');
    // Wait for ready-to-show microtask
    await Promise.resolve();
    expect(win.show).toHaveBeenCalled();
  });

  it('should focus existing window instead of creating duplicate', async () => {
    const win1 = manager.openWindow({ module: 'stock' });
    await Promise.resolve(); // ready-to-show fires
    const win2 = manager.openWindow({ module: 'stock' });
    expect(win1).toBe(win2);
    expect(win1.focus).toHaveBeenCalled();
  });

  it('should track open modules', () => {
    manager.openWindow({ module: 'stock' });
    manager.openWindow({ module: 'automation' });
    const modules = manager.getOpenModules();
    expect(modules).toContain('stock');
    expect(modules).toContain('automation');
  });

  it('should enforce max window limit', () => {
    for (let i = 0; i < 10; i++) {
      manager.openWindow({ module: `module-${i}` });
    }
    expect(() => manager.openWindow({ module: 'module-10' })).toThrow('Maximum window limit');
  });

  it('should get a specific window', () => {
    manager.openWindow({ module: 'stock' });
    const win = manager.getWindow('stock');
    expect(win).toBeDefined();
  });

  it('should return undefined for non-existent window', () => {
    expect(manager.getWindow('nonexistent')).toBeUndefined();
  });

  it('should close a specific window', () => {
    const win = manager.openWindow({ module: 'stock' });
    manager.closeWindow('stock');
    expect(win.close).toHaveBeenCalled();
  });

  it('should apply custom options', () => {
    const win = manager.openWindow({
      module: 'stock',
      options: { width: 1600, height: 900 },
    });
    expect(win._options.width).toBe(1600);
    expect(win._options.height).toBe(900);
  });

  it('should send messages to specific window', () => {
    const win = manager.openWindow({ module: 'stock' });
    manager.sendToWindow('stock', 'test:channel', { data: 1 });
    expect(win.webContents.send).toHaveBeenCalledWith('test:channel', { data: 1 });
  });

  it('should broadcast to all windows', () => {
    const win1 = manager.openWindow({ module: 'stock' });
    const win2 = manager.openWindow({ module: 'automation' });
    manager.broadcast('update:config', 'payload');
    expect(win1.webContents.send).toHaveBeenCalledWith('update:config', 'payload');
    expect(win2.webContents.send).toHaveBeenCalledWith('update:config', 'payload');
  });

  it('should close all windows', () => {
    const win1 = manager.openWindow({ module: 'stock' });
    const win2 = manager.openWindow({ module: 'automation' });
    manager.closeAll();
    expect(win1.close).toHaveBeenCalled();
    expect(win2.close).toHaveBeenCalled();
  });
});
