import { WebContentsView, Session, session } from 'electron';
import { EventBus } from '../ipc/EventBus';
import type { TaskStep } from '@shared/types';
import type { Tab } from '@shared/types/browser';

export type TabInfo = Tab;

export interface TabManagerOptions {
  eventBus?: Pick<EventBus, 'emit'>;
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
    if (!options.eventBus) {
      throw new Error('eventBus is required');
    }

    this.eventBus = options.eventBus as EventBus;
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
    return this.createView(url, this.session, this.sessionPartition);
  }

  private createView(url: string, targetSession: Session, partitionLabel: string): WebContentsView {
    if (this.tabs.size >= this.maxTabs) {
      throw new Error(`Maximum tab limit (${this.maxTabs}) reached`);
    }

    const view = new WebContentsView({
      webPreferences: {
        session: targetSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const id = view.webContents.id;
    this.tabs.set(id, view);
    this.tabSessions.set(id, partitionLabel);

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

  async startRecorder(tabId?: number): Promise<{ recording: boolean }> {
    await this.executeJavaScript(
      `
      (() => {
        const globalKey = '__yclawRecorder__';
        const existing = window[globalKey];
        if (existing?.cleanup) {
          existing.cleanup();
        }

        const getSelector = (element) => {
          if (!element) return '';
          if (element.id) return '#' + CSS.escape(element.id);

          const parts = [];
          let current = element;
          while (current && current !== document.body && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();
            if (current.classList && current.classList.length > 0) {
              selector += '.' + Array.from(current.classList)
                .slice(0, 2)
                .map((name) => CSS.escape(name))
                .join('.');
            }
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                (child) => child.tagName === current.tagName,
              );
              if (siblings.length > 1) {
                selector += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
              }
            }
            parts.unshift(selector);
            current = current.parentElement;
          }
          return parts.join(' > ');
        };

        const toStep = (name, action) => ({
          id: 'recorded-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          name,
          action,
        });

        const state = {
          steps: [],
          handlers: [],
        };

        const pushStep = (step) => {
          state.steps.push(step);
        };

        const clickHandler = (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          pushStep(
            toStep('点击 ' + (target.textContent?.trim() || target.tagName.toLowerCase()), {
              type: 'click',
              selector: getSelector(target),
            }),
          );
        };

        const inputHandler = (event) => {
          const target =
            event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
              ? event.target
              : null;
          if (!target) return;
          pushStep(
            toStep('输入 ' + (target.name || target.id || target.tagName.toLowerCase()), {
              type: 'input',
              selector: getSelector(target),
              params: { value: target.value },
            }),
          );
        };

        const changeHandler = (event) => {
          const target = event.target instanceof HTMLSelectElement ? event.target : null;
          if (!target) return;
          pushStep(
            toStep('选择 ' + (target.name || target.id || target.tagName.toLowerCase()), {
              type: 'input',
              selector: getSelector(target),
              params: { value: target.value },
            }),
          );
        };

        let scrollTimer = null;
        const scrollHandler = () => {
          if (scrollTimer) clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            pushStep(
              toStep('页面滚动', {
                type: 'scroll',
                selector: 'body',
                params: { x: window.scrollX, y: window.scrollY },
              }),
            );
            scrollTimer = null;
          }, 300);
        };

        document.addEventListener('click', clickHandler, true);
        document.addEventListener('input', inputHandler, true);
        document.addEventListener('change', changeHandler, true);
        window.addEventListener('scroll', scrollHandler, true);

        state.handlers.push(
          ['click', clickHandler, true],
          ['input', inputHandler, true],
          ['change', changeHandler, true],
        );

        window[globalKey] = {
          getSteps: () => state.steps,
          cleanup: () => {
            state.handlers.forEach(([type, handler, capture]) => {
              document.removeEventListener(type, handler, capture);
            });
            window.removeEventListener('scroll', scrollHandler, true);
          },
        };
      })();
      `,
      tabId,
    );

    return { recording: true };
  }

  async stopRecorder(tabId?: number): Promise<TaskStep[]> {
    const result = await this.executeJavaScript(
      `
      (() => {
        const recorder = window.__yclawRecorder__;
        if (!recorder) {
          return [];
        }

        const steps = Array.isArray(recorder.getSteps?.()) ? recorder.getSteps() : [];
        recorder.cleanup?.();
        delete window.__yclawRecorder__;
        return steps;
      })();
      `,
      tabId,
    );

    return (result as TaskStep[]) ?? [];
  }

  /**
   * 创建临时隔离会话标签
   */
  createIsolatedTab(url = 'about:blank'): WebContentsView {
    const partitionLabel = `temp:${Date.now()}`;
    return this.createView(url, session.fromPartition(partitionLabel), partitionLabel);
  }

  getOrCreateTabBySession(sessionPartition: string, url = 'about:blank'): WebContentsView {
    for (const [id, view] of this.tabs.entries()) {
      if ((this.tabSessions.get(id) ?? this.sessionPartition) === sessionPartition) {
        this.activeTabId = id;
        return view;
      }
    }

    if (sessionPartition === this.sessionPartition) {
      return this.createTab(url);
    }

    if (sessionPartition === 'default') {
      return this.createView(url, session.defaultSession, 'default');
    }

    return this.createView(url, session.fromPartition(sessionPartition), sessionPartition);
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
