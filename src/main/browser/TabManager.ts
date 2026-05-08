import { WebContentsView, Session, session } from 'electron';
import { EventBus } from '../ipc/EventBus';
import type {
  ApiReplayDraft,
  InvestigationCookie,
  InvestigationNetworkRecord,
  InvestigationRecordingResult,
  InvestigationStorageSnapshot,
  RecorderSitePreset,
  RecorderStartOptions,
  TaskStep,
} from '@shared/types';
import type { Tab } from '@shared/types/browser';

export type TabInfo = Tab;

export interface TabManagerOptions {
  eventBus?: Pick<EventBus, 'emit'>;
  /** 隔离会话名（默认 default） */
  sessionPartition?: string;
  /** 最大标签页数 */
  maxTabs?: number;
}

interface InvestigationSession {
  tabId: number;
  startedAt: string;
  sitePreset: RecorderSitePreset;
  domainAllowlist: string[];
  filterStaticResources: boolean;
  captureStorageSnapshot: boolean;
  records: Map<string, InvestigationNetworkRecord>;
  listener: (...args: unknown[]) => void;
  attachedByRecorder: boolean;
}

const DEFAULT_BACKGROUND_VIEWPORT = {
  x: 0,
  y: 0,
  width: 1440,
  height: 900,
} as const;

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
  private investigationSessions = new Map<number, InvestigationSession>();

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
        backgroundThrottling: false,
      },
    });
    view.setBounds(DEFAULT_BACKGROUND_VIEWPORT);

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
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (url) {
        view.webContents.loadURL(url);
        this.eventBus.emit('tab:navigate', { ...this.getTabInfo(id), url });
      }
      return { action: 'deny' };
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

    void this.stopExistingInvestigationSession(id);
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

  async startRecorder(
    tabId?: number,
    options: RecorderStartOptions = {},
  ): Promise<{ recording: boolean; mode: 'steps' | 'investigation' }> {
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

    if (options.mode === 'investigation' || options.includeNetwork) {
      await this.startInvestigationRecorder(tabId, options);
      return { recording: true, mode: 'investigation' };
    }

    return { recording: true, mode: 'steps' };
  }

  async stopRecorder(tabId?: number): Promise<TaskStep[] | InvestigationRecordingResult> {
    const id = tabId ?? this.activeTabId;
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

    const steps = Array.isArray(result) ? (result as TaskStep[]) : [];
    if (id == null || !this.investigationSessions.has(id)) {
      return steps;
    }

    return this.stopInvestigationRecorder(id, steps);
  }

  private async startInvestigationRecorder(
    tabId: number | undefined,
    options: RecorderStartOptions,
  ): Promise<void> {
    const view = this.getView(tabId);
    if (!view) {
      throw new Error('No active tab');
    }

    const id = view.webContents.id;
    const debuggerApi = view.webContents.debugger;
    if (!debuggerApi) {
      throw new Error('Electron debugger API is not available');
    }

    await this.stopExistingInvestigationSession(id);

    const sitePreset = options.sitePreset ?? 'custom';
    const domainAllowlist = normalizeDomainAllowlist(options.domainAllowlist ?? []);
    const records = new Map<string, InvestigationNetworkRecord>();
    const filterStaticResources = options.filterStaticResources ?? true;
    const captureStorageSnapshot = options.captureStorageSnapshot ?? true;
    const attachedByRecorder = !debuggerApi.isAttached();

    const listener = (_event: unknown, method: unknown, params: unknown) => {
      if (typeof method !== 'string' || typeof params !== 'object' || params === null) {
        return;
      }

      const payload = params as Record<string, any>;
      const requestId = typeof payload.requestId === 'string' ? payload.requestId : null;
      if (!requestId) {
        return;
      }

      if (method === 'Network.requestWillBeSent') {
        const request = payload.request as Record<string, any> | undefined;
        const url = typeof request?.url === 'string' ? request.url : '';
        if (!shouldRecordUrl(url, domainAllowlist)) {
          return;
        }

        records.set(requestId, {
          requestId,
          method: typeof request?.method === 'string' ? request.method : 'GET',
          url,
          requestHeaders: normalizeHeaders(request?.headers),
          requestBody: typeof request?.postData === 'string' ? request.postData : undefined,
          requestTimestamp: typeof payload.timestamp === 'number' ? payload.timestamp : undefined,
        });
        return;
      }

      const current = records.get(requestId);
      if (!current) {
        return;
      }

      if (method === 'Network.responseReceived') {
        const response = payload.response as Record<string, any> | undefined;
        const resourceType = typeof payload.type === 'string' ? payload.type : undefined;
        const mimeType = typeof response?.mimeType === 'string' ? response.mimeType : undefined;
        if (filterStaticResources && isStaticResource(current.url, resourceType, mimeType)) {
          records.delete(requestId);
          return;
        }

        records.set(requestId, {
          ...current,
          status: typeof response?.status === 'number' ? response.status : undefined,
          statusText: typeof response?.statusText === 'string' ? response.statusText : undefined,
          responseHeaders: normalizeHeaders(response?.headers),
          mimeType,
          resourceType,
          responseTimestamp: typeof payload.timestamp === 'number' ? payload.timestamp : undefined,
        });
        return;
      }

      if (method === 'Network.loadingFinished') {
        records.set(requestId, {
          ...current,
          finishedTimestamp: typeof payload.timestamp === 'number' ? payload.timestamp : undefined,
        });
      }
    };

    if (attachedByRecorder) {
      debuggerApi.attach('1.3');
    }
    debuggerApi.on('message', listener);
    await debuggerApi.sendCommand('Network.enable');

    this.investigationSessions.set(id, {
      tabId: id,
      startedAt: new Date().toISOString(),
      sitePreset,
      domainAllowlist,
      filterStaticResources,
      captureStorageSnapshot,
      records,
      listener,
      attachedByRecorder,
    });
  }

  private async stopInvestigationRecorder(
    tabId: number,
    steps: TaskStep[],
  ): Promise<InvestigationRecordingResult> {
    const sessionState = this.investigationSessions.get(tabId);
    if (!sessionState) {
      const timestamp = new Date().toISOString();
      return {
        kind: 'investigation-recording',
        tabId,
        startedAt: timestamp,
        stoppedAt: timestamp,
        sitePreset: 'custom',
        domainAllowlist: [],
        steps,
        network: [],
        replayDrafts: [],
      };
    }

    await this.hydrateResponseBodies(tabId, sessionState.records);
    const storageSnapshot = sessionState.captureStorageSnapshot
      ? await this.captureStorageSnapshot(tabId, sessionState.domainAllowlist)
      : undefined;
    await this.cleanupInvestigationSession(tabId, sessionState);

    const network = Array.from(sessionState.records.values());
    return {
      kind: 'investigation-recording',
      tabId,
      startedAt: sessionState.startedAt,
      stoppedAt: new Date().toISOString(),
      sitePreset: sessionState.sitePreset,
      domainAllowlist: sessionState.domainAllowlist,
      steps,
      network,
      storageSnapshot,
      replayDrafts: buildReplayDrafts(network),
    };
  }

  private async stopExistingInvestigationSession(tabId: number): Promise<void> {
    const existing = this.investigationSessions.get(tabId);
    if (existing) {
      await this.cleanupInvestigationSession(tabId, existing);
    }
  }

  private async cleanupInvestigationSession(
    tabId: number,
    sessionState: InvestigationSession,
  ): Promise<void> {
    const view = this.getView(tabId);
    const debuggerApi = view?.webContents.debugger;
    if (debuggerApi) {
      try {
        if (typeof debuggerApi.off === 'function') {
          debuggerApi.off('message', sessionState.listener);
        }
      } catch {
        /* noop */
      }
      try {
        await debuggerApi.sendCommand('Network.disable');
      } catch {
        /* noop */
      }
      if (sessionState.attachedByRecorder) {
        try {
          if (debuggerApi.isAttached()) {
            debuggerApi.detach();
          }
        } catch {
          /* noop */
        }
      }
    }
    this.investigationSessions.delete(tabId);
  }

  private async hydrateResponseBodies(
    tabId: number,
    records: Map<string, InvestigationNetworkRecord>,
  ): Promise<void> {
    const view = this.getView(tabId);
    const debuggerApi = view?.webContents.debugger;
    if (!debuggerApi) {
      return;
    }

    await Promise.all(
      Array.from(records.values()).map(async (record) => {
        if (record.responseBody !== undefined || record.status === undefined) {
          return;
        }
        try {
          const response = await debuggerApi.sendCommand('Network.getResponseBody', {
            requestId: record.requestId,
          }) as {
            body?: string;
            base64Encoded?: boolean;
          };
          record.responseBody = typeof response.body === 'string' ? response.body : undefined;
          record.responseBodyBase64Encoded = response.base64Encoded === true;
        } catch {
          record.responseBody = undefined;
        }
      }),
    );
  }

  private async captureStorageSnapshot(
    tabId: number,
    domainAllowlist: string[],
  ): Promise<InvestigationStorageSnapshot | undefined> {
    const view = this.getView(tabId);
    if (!view) {
      return undefined;
    }

    const storage = await this.executeJavaScript(
      `
      (() => {
        const readStorage = (storage) => {
          const output = {};
          if (!storage) return output;
          for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (!key) continue;
            const value = storage.getItem(key);
            if (typeof value === 'string') {
              output[key] = value;
            }
          }
          return output;
        };
        return {
          pageUrl: window.location.href,
          pageTitle: document.title,
          localStorage: readStorage(window.localStorage),
          sessionStorage: readStorage(window.sessionStorage),
        };
      })();
      `,
      tabId,
    ) as {
      pageUrl?: string;
      pageTitle?: string;
      localStorage?: Record<string, string>;
      sessionStorage?: Record<string, string>;
    } | null;

    let cookies: InvestigationCookie[] = [];
    try {
      const allCookies = await view.webContents.session.cookies.get({});
      cookies = allCookies
        .filter((cookie: { name?: string; domain?: string }) =>
          shouldRecordCookie(cookie.name, cookie.domain, domainAllowlist, storage?.pageUrl),
        )
        .map(normalizeCookie);
    } catch {
      cookies = [];
    }

    return {
      pageUrl: storage?.pageUrl,
      pageTitle: storage?.pageTitle,
      cookieDomains: Array.from(
        new Set(
          cookies
            .map((cookie) => cookie.domain)
            .filter((domain): domain is string => typeof domain === 'string' && domain.length > 0),
        ),
      ),
      cookies,
      localStorage: storage?.localStorage ?? {},
      sessionStorage: storage?.sessionStorage ?? {},
    };
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

function normalizeDomainAllowlist(domains: string[]): string[] {
  return domains
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0);
}

function normalizeHeaders(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function shouldRecordUrl(url: string, domainAllowlist: string[]): boolean {
  if (domainAllowlist.length === 0) {
    return true;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domainAllowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function isStaticResource(url: string, resourceType?: string, mimeType?: string): boolean {
  const normalizedType = resourceType?.toLowerCase() ?? '';
  if (['image', 'stylesheet', 'font', 'media'].includes(normalizedType)) {
    return true;
  }

  const normalizedMime = mimeType?.toLowerCase() ?? '';
  if (
    normalizedMime.startsWith('image/')
    || normalizedMime.includes('font')
    || normalizedMime.includes('text/css')
  ) {
    return true;
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(?:png|jpe?g|gif|webp|svg|ico|css|woff2?|ttf|otf|mp4|webm|mp3|m4a)$/.test(pathname);
  } catch {
    return false;
  }
}

function normalizeCookie(cookie: {
  name?: string;
  value?: string;
  domain?: string;
  hostOnly?: boolean;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  session?: boolean;
  expirationDate?: number;
  sameSite?: string;
}): InvestigationCookie {
  return {
    name: typeof cookie.name === 'string' ? cookie.name : '',
    value: typeof cookie.value === 'string' ? cookie.value : '',
    domain: typeof cookie.domain === 'string' ? cookie.domain : undefined,
    hostOnly: typeof cookie.hostOnly === 'boolean' ? cookie.hostOnly : undefined,
    path: typeof cookie.path === 'string' ? cookie.path : undefined,
    secure: typeof cookie.secure === 'boolean' ? cookie.secure : undefined,
    httpOnly: typeof cookie.httpOnly === 'boolean' ? cookie.httpOnly : undefined,
    session: typeof cookie.session === 'boolean' ? cookie.session : undefined,
    expirationDate:
      typeof cookie.expirationDate === 'number' ? cookie.expirationDate : undefined,
    sameSite: typeof cookie.sameSite === 'string' ? cookie.sameSite : undefined,
  };
}

const CROSS_DOMAIN_COOKIE_ALLOWLIST = new Set(['pin', 'thor', 'pt_key', 'pt_pin']);

function shouldRecordCookie(
  cookieName: string | undefined,
  cookieDomain: string | undefined,
  domainAllowlist: string[],
  pageUrl: string | undefined,
): boolean {
  const normalizedCookieDomain = normalizeCookieDomain(cookieDomain);
  if (!normalizedCookieDomain) {
    return false;
  }

  const domains =
    domainAllowlist.length > 0
      ? domainAllowlist
      : resolvePageCookieDomains(pageUrl);

  if (domains.length === 0) {
    return true;
  }

  return domains.some((domain) => {
    const normalizedDomain = normalizeCookieDomain(domain);
    return (
      normalizedDomain === normalizedCookieDomain
      || normalizedCookieDomain.endsWith(`.${normalizedDomain}`)
      || (
        normalizedDomain.endsWith(`.${normalizedCookieDomain}`)
        && typeof cookieName === 'string'
        && CROSS_DOMAIN_COOKIE_ALLOWLIST.has(cookieName)
      )
    );
  });
}

function normalizeCookieDomain(domain: string | undefined): string {
  return domain?.trim().replace(/^\./, '').toLowerCase() ?? '';
}

function resolvePageCookieDomains(pageUrl: string | undefined): string[] {
  if (!pageUrl) {
    return [];
  }
  try {
    return [new URL(pageUrl).hostname.toLowerCase()];
  } catch {
    return [];
  }
}

function buildReplayDrafts(records: InvestigationNetworkRecord[]): ApiReplayDraft[] {
  const keywordPattern = /sign|signin|checkin|bean|reward|jingdou|jdbean|activity|task/i;
  return records
    .filter((record) => {
      const text = [
        record.url,
        record.requestBody ?? '',
        record.responseBody ?? '',
      ].join('\n');
      return keywordPattern.test(text);
    })
    .map((record) => ({
      method: record.method,
      url: record.url,
      headers: record.requestHeaders,
      body: record.requestBody,
      reason: resolveReplayReason(record),
    }));
}

function resolveReplayReason(record: InvestigationNetworkRecord): string {
  const candidates = [
    record.url,
    record.requestBody ?? '',
    record.responseBody ?? '',
  ].join('\n');
  const matched = candidates.match(/sign|signin|checkin|bean|reward|jingdou|jdbean|activity|task/i);
  return matched ? `matched keyword "${matched[0]}"` : 'matched candidate API';
}
