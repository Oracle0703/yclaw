import { WebContentsView, Session, session } from 'electron';
import { EventBus } from '../ipc/EventBus';

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  sessionPartition: string;
}

export interface TabManagerOptions {
  /** 隔离会话名（默认 default） */
  sessionPartition?: string;
  /** 最大标签页数 */
  maxTabs?: number;
}

/**
 * 多标签页浏览器管理器
 * 基于 WebContentsView 实现标签页生命周期管理
 */
export class TabManager {
  private tabs = new Map<number, WebContentsView>();
  private tabSessions = new Map<number, string>();
  private activeTabId: number | null = null;
  private eventBus: EventBus;
  private session: Session;
  private readonly sessionPartition: string;
  private readonly maxTabs: number;

  constructor(options: TabManagerOptions = {}) {
    this.eventBus = EventBus.getInstance();
    this.maxTabs = options.maxTabs ?? 20;
    this.sessionPartition = options.sessionPartition
      ? `persist:${options.sessionPartition}`
      : 'default';
    this.session = options.sessionPartition
      ? session.fromPartition(this.sessionPartition)
      : session.defaultSession;
  }

  /**
   * 新建标签页
   */
  createTab(url = 'about:blank'): WebContentsView {
    if (this.tabs.size >= this.maxTabs) {
      throw new Error(`Maximum tab limit (${this.maxTabs}) reached`);
    }

    const view = new WebContentsView({
      webPreferences: {
        session: this.session,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const id = view.webContents.id;
    this.tabs.set(id, view);
    this.tabSessions.set(id, this.sessionPartition);

    // 监听页面事件
    view.webContents.on('did-start-loading', () => {
      this.eventBus.emit('tab:loading', { ...this.getTabInfo(id), loading: true });
    });
    view.webContents.on('did-stop-loading', () => {
      this.eventBus.emit('tab:loading', { ...this.getTabInfo(id), loading: false });
    });
    view.webContents.on('page-title-updated', (_e, title) => {
      this.eventBus.emit('tab:title', { ...this.getTabInfo(id), title });
    });
    view.webContents.on('did-navigate', (_e, url) => {
      this.eventBus.emit('tab:navigate', { ...this.getTabInfo(id), url });
    });

    view.webContents.loadURL(url);
    this.activeTabId = id;

    return view;
  }

  /**
   * 关闭标签页
   */
  closeTab(id: number): void {
    const view = this.tabs.get(id);
    if (!view) return;

    view.webContents.close();
    this.tabs.delete(id);
    this.tabSessions.delete(id);

    if (this.activeTabId === id) {
      const remaining = Array.from(this.tabs.keys());
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }
  }

  /**
   * 切换激活标签
   */
  switchTab(id: number): void {
    if (!this.tabs.has(id)) throw new Error(`Tab ${id} not found`);
    this.activeTabId = id;
  }

  /**
   * 导航
   */
  navigate(url: string, tabId?: number): void {
    const id = tabId ?? this.activeTabId;
    if (id == null) return;
    const view = this.tabs.get(id);
    if (view) view.webContents.loadURL(url);
  }

  goBack(tabId?: number): void {
    const view = this.getView(tabId);
    if (view?.webContents.canGoBack()) view.webContents.goBack();
  }

  goForward(tabId?: number): void {
    const view = this.getView(tabId);
    if (view?.webContents.canGoForward()) view.webContents.goForward();
  }

  reload(tabId?: number): void {
    const view = this.getView(tabId);
    view?.webContents.reload();
  }

  /**
   * 注入 JS 脚本（仅内部受控脚本）
   */
  async executeJavaScript(script: string, tabId?: number): Promise<unknown> {
    const view = this.getView(tabId);
    if (!view) throw new Error('No active tab');
    return view.webContents.executeJavaScript(script);
  }

  /**
   * 创建临时隔离会话标签
   */
  createIsolatedTab(url = 'about:blank'): WebContentsView {
    const isolatedSession = session.fromPartition(`temp:${Date.now()}`);
    const view = new WebContentsView({
      webPreferences: {
        session: isolatedSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const id = view.webContents.id;
    this.tabs.set(id, view);
    this.tabSessions.set(id, `temp:${id}`);
    view.webContents.loadURL(url);
    this.activeTabId = id;

    return view;
  }

  getTabInfo(id: number): TabInfo | undefined {
    const view = this.tabs.get(id);
    if (!view) return undefined;
    return {
      id,
      title: view.webContents.getTitle(),
      url: view.webContents.getURL(),
      loading: view.webContents.isLoading(),
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward(),
      sessionPartition: this.tabSessions.get(id) ?? this.sessionPartition,
    };
  }

  getAllTabs(): TabInfo[] {
    return Array.from(this.tabs.keys())
      .map((id) => this.getTabInfo(id)!)
      .filter(Boolean);
  }

  getActiveTabId(): number | null {
    return this.activeTabId;
  }

  getView(tabId?: number): WebContentsView | undefined {
    const id = tabId ?? this.activeTabId;
    return id != null ? this.tabs.get(id) : undefined;
  }

  getTabCount(): number {
    return this.tabs.size;
  }

  closeAll(): void {
    for (const id of [...this.tabs.keys()]) {
      this.closeTab(id);
    }
  }
}
