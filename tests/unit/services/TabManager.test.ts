import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron modules
vi.mock('electron', () => ({
  WebContentsView: vi.fn().mockImplementation(() => ({
    webContents: {
      id: Math.floor(Math.random() * 10000),
      on: vi.fn(),
      loadURL: vi.fn(),
      close: vi.fn(),
      getTitle: vi.fn().mockReturnValue('Test Page'),
      getURL: vi.fn().mockReturnValue('https://example.com'),
      isLoading: vi.fn().mockReturnValue(false),
      canGoBack: vi.fn().mockReturnValue(true),
      canGoForward: vi.fn().mockReturnValue(false),
      goBack: vi.fn(),
      goForward: vi.fn(),
      reload: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue('result'),
    },
  })),
  session: {
    defaultSession: { id: 'default' },
    fromPartition: vi.fn().mockReturnValue({ id: 'custom' }),
  },
}));

// Mock EventBus
vi.mock('@main/ipc/EventBus', () => {
  const emitFn = vi.fn();
  return {
    EventBus: {
      getInstance: vi.fn().mockReturnValue({
        emit: emitFn,
        on: vi.fn(),
        off: vi.fn(),
      }),
    },
  };
});

import { TabManager } from '@main/browser/TabManager';
import { EventBus } from '@main/ipc/EventBus';

describe('TabManager', () => {
  let tabManager: TabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tabManager = new TabManager({ maxTabs: 5 });
  });

  describe('createTab', () => {
    it('should create a new tab and set it as active', () => {
      const view = tabManager.createTab('https://example.com');
      expect(view).toBeDefined();
      expect(view.webContents.loadURL).toHaveBeenCalledWith('https://example.com');
      expect(tabManager.getTabCount()).toBe(1);
      expect(tabManager.getActiveTabId()).toBe(view.webContents.id);
    });

    it('should create tab with default about:blank URL', () => {
      const view = tabManager.createTab();
      expect(view.webContents.loadURL).toHaveBeenCalledWith('about:blank');
    });

    it('should create multiple tabs', () => {
      tabManager.createTab('https://a.com');
      tabManager.createTab('https://b.com');
      tabManager.createTab('https://c.com');
      expect(tabManager.getTabCount()).toBe(3);
    });

    it('should throw when max tabs limit reached', () => {
      for (let i = 0; i < 5; i++) tabManager.createTab();
      expect(() => tabManager.createTab()).toThrow('Maximum tab limit (5) reached');
    });

    it('should register event listeners on webContents', () => {
      const view = tabManager.createTab();
      expect(view.webContents.on).toHaveBeenCalledWith('did-start-loading', expect.any(Function));
      expect(view.webContents.on).toHaveBeenCalledWith('did-stop-loading', expect.any(Function));
      expect(view.webContents.on).toHaveBeenCalledWith('page-title-updated', expect.any(Function));
      expect(view.webContents.on).toHaveBeenCalledWith('did-navigate', expect.any(Function));
    });
  });

  describe('closeTab', () => {
    it('should close and remove a tab', () => {
      const view = tabManager.createTab();
      const id = view.webContents.id;
      tabManager.closeTab(id);
      expect(view.webContents.close).toHaveBeenCalled();
      expect(tabManager.getTabCount()).toBe(0);
    });

    it('should update active tab when closing active', () => {
      const view1 = tabManager.createTab('https://a.com');
      const view2 = tabManager.createTab('https://b.com');
      // view2 is active
      tabManager.closeTab(view2.webContents.id);
      expect(tabManager.getActiveTabId()).toBe(view1.webContents.id);
    });

    it('should set active to null when all tabs closed', () => {
      const view = tabManager.createTab();
      tabManager.closeTab(view.webContents.id);
      expect(tabManager.getActiveTabId()).toBeNull();
    });

    it('should ignore closing non-existent tab', () => {
      expect(() => tabManager.closeTab(99999)).not.toThrow();
    });
  });

  describe('switchTab', () => {
    it('should switch active tab', () => {
      const view1 = tabManager.createTab();
      const view2 = tabManager.createTab();
      tabManager.switchTab(view1.webContents.id);
      expect(tabManager.getActiveTabId()).toBe(view1.webContents.id);
    });

    it('should throw when switching to non-existent tab', () => {
      expect(() => tabManager.switchTab(99999)).toThrow('Tab 99999 not found');
    });
  });

  describe('navigation', () => {
    it('should navigate active tab to URL', () => {
      const view = tabManager.createTab();
      tabManager.navigate('https://new-url.com');
      expect(view.webContents.loadURL).toHaveBeenCalledWith('https://new-url.com');
    });

    it('should navigate specific tab by ID', () => {
      const view1 = tabManager.createTab();
      const view2 = tabManager.createTab();
      tabManager.navigate('https://specific.com', view1.webContents.id);
      expect(view1.webContents.loadURL).toHaveBeenCalledWith('https://specific.com');
    });

    it('should call goBack on active tab', () => {
      const view = tabManager.createTab();
      tabManager.goBack();
      expect(view.webContents.goBack).toHaveBeenCalled();
    });

    it('should call goForward on active tab', () => {
      const view = tabManager.createTab();
      view.webContents.canGoForward = vi.fn().mockReturnValue(true);
      tabManager.goForward();
      expect(view.webContents.goForward).toHaveBeenCalled();
    });

    it('should call reload on active tab', () => {
      const view = tabManager.createTab();
      tabManager.reload();
      expect(view.webContents.reload).toHaveBeenCalled();
    });
  });

  describe('executeJavaScript', () => {
    it('should execute script in active tab', async () => {
      const view = tabManager.createTab();
      const result = await tabManager.executeJavaScript('document.title');
      expect(view.webContents.executeJavaScript).toHaveBeenCalledWith('document.title');
      expect(result).toBe('result');
    });

    it('should throw when no active tab', async () => {
      await expect(tabManager.executeJavaScript('test')).rejects.toThrow('No active tab');
    });
  });

  describe('getTabInfo', () => {
    it('should return tab info', () => {
      const view = tabManager.createTab();
      const info = tabManager.getTabInfo(view.webContents.id);
      expect(info).toEqual({
        id: view.webContents.id,
        title: 'Test Page',
        url: 'https://example.com',
        loading: false,
        canGoBack: true,
        canGoForward: false,
      });
    });

    it('should return undefined for non-existent tab', () => {
      expect(tabManager.getTabInfo(99999)).toBeUndefined();
    });
  });

  describe('getAllTabs', () => {
    it('should return info for all tabs', () => {
      tabManager.createTab();
      tabManager.createTab();
      const allTabs = tabManager.getAllTabs();
      expect(allTabs).toHaveLength(2);
    });
  });

  describe('createIsolatedTab', () => {
    it('should create tab with unique session', () => {
      const { session } = require('electron') as typeof import('electron');
      const view = tabManager.createIsolatedTab('https://isolated.com');
      // session.fromPartition is called during isolated tab creation
      expect(view.webContents.loadURL).toHaveBeenCalledWith('https://isolated.com');
      expect(tabManager.getTabCount()).toBe(1);
    });
  });

  describe('closeAll', () => {
    it('should close all tabs', () => {
      tabManager.createTab();
      tabManager.createTab();
      tabManager.createTab();
      tabManager.closeAll();
      expect(tabManager.getTabCount()).toBe(0);
      expect(tabManager.getActiveTabId()).toBeNull();
    });
  });
});
