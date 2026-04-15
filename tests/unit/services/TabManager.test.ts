import { describe, it, expect, vi, beforeEach } from 'vitest';
import { session } from 'electron';

let nextTabId = 1;

// Mock Electron modules
vi.mock('electron', () => ({
  WebContentsView: vi.fn().mockImplementation(() => ({
    webContents: {
      id: nextTabId++,
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

describe('TabManager', () => {
  let tabManager: TabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    nextTabId = 1;
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
      tabManager.createTab();
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
      tabManager.createTab();
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
        sessionPartition: 'default',
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
      const view = tabManager.createIsolatedTab('https://isolated.com');
      // session.fromPartition is called during isolated tab creation
      expect(session.fromPartition).toHaveBeenCalled();
      expect(view.webContents.loadURL).toHaveBeenCalledWith('https://isolated.com');
      expect(tabManager.getTabCount()).toBe(1);
    });
  });

  describe('session info', () => {
    it('should expose configured persistent session partition in tab info', () => {
      const partitionedManager = new TabManager({ sessionPartition: 'workspace-a' });
      const view = partitionedManager.createTab('https://example.com');

      expect(session.fromPartition).toHaveBeenCalledWith('persist:workspace-a');
      expect(partitionedManager.getTabInfo(view.webContents.id)).toMatchObject({
        sessionPartition: 'persist:workspace-a',
      });
    });

    it('should mark isolated tabs with a temporary session partition', () => {
      const view = tabManager.createIsolatedTab('https://isolated.com');
      expect(tabManager.getTabInfo(view.webContents.id)?.sessionPartition).toMatch(/^temp:/);
    });

    it('reuses an existing tab for the same intervention session partition', () => {
      const first = tabManager.createTab('https://example.com');
      const recovered = tabManager.getOrCreateTabBySession('default', 'https://example.com');

      expect(recovered.webContents.id).toBe(first.webContents.id);
    });

    it('creates a persistent tab for a named intervention session partition', () => {
      const recovered = tabManager.getOrCreateTabBySession(
        'persist:session_a',
        'https://example.com',
      );

      expect(session.fromPartition).toHaveBeenCalledWith('persist:session_a');
      expect(tabManager.getTabInfo(recovered.webContents.id)).toMatchObject({
        sessionPartition: 'persist:session_a',
      });
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
