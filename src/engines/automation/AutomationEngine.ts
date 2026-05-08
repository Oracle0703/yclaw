import type { ActionDefinition, ActionResult, AutomationPage } from './types';
import type { ResultService } from '@main/services/ResultService';
import { HotRssParser } from '@main/services/hot/HotRssParser';

export interface ActionExecutionContext {
  taskId: string;
  batchId: string;
  templateId?: string | null;
  sourceUrl?: string;
}

export interface AutomationEngineOptions {
  resultService?: Pick<ResultService, 'saveResult'>;
}

/**
 * 自动化引擎核心 — 通过页面执行句柄操控页面
 * 支持 5 种基础操作: click / input / scroll / extract / screenshot
 */
export class AutomationEngine {
  private readonly defaultTimeout = 30000;
  private readonly resultService?: Pick<ResultService, 'saveResult'>;

  constructor(options: AutomationEngineOptions = {}) {
    this.resultService = options.resultService;
  }

  /**
   * 执行单个操作
   */
  async execute(
    webContents: AutomationPage,
    action: ActionDefinition,
    context?: ActionExecutionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const timeout = action.timeout ?? this.defaultTimeout;

    try {
      const data = await this.runAction(webContents, action, timeout);
      const result: ActionResult = {
        stepId: '',
        actionType: action.type,
        success: true,
        data,
        duration: Date.now() - startTime,
      };
      this.persistExtractionResult(action, result, context);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        stepId: '',
        actionType: action.type,
        success: false,
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  private persistExtractionResult(
    action: ActionDefinition,
    result: ActionResult,
    context?: ActionExecutionContext,
  ): void {
    if (action.type !== 'extract' || !result.success || !this.resultService || !context) {
      return;
    }

    const isApiExtract = action.params?.mode === 'api';
    const createdAt = new Date().toISOString();
    const sourceUrl = context.sourceUrl ?? (isApiExtract ? action.selector : undefined);

    const isCommentExtract = resolveCommentParserPlatform(action.params?.parserKey) !== null;
    if ((isApiExtract || isCommentExtract) && Array.isArray(result.data)) {
      for (const item of result.data) {
        this.resultService.saveResult({
          taskId: context.taskId,
          batchId: context.batchId,
          templateId: context.templateId ?? null,
          data: isRecord(item) ? item : { value: item },
          status: 'normal',
          sourceUrl,
          createdAt,
        });
      }
      return;
    }

    this.resultService.saveResult({
      taskId: context.taskId,
      batchId: context.batchId,
      templateId: context.templateId ?? null,
      data: {
        selector: action.selector,
        value: result.data,
      },
      status: 'normal',
      sourceUrl,
      createdAt,
    });
  }

  private async runAction(
    wc: AutomationPage,
    action: ActionDefinition,
    timeout: number,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Action "${action.type}" timed out after ${timeout}ms`)),
        timeout,
      );
    });

    const actionPromise = this.dispatchAction(wc, action);
    return Promise.race([actionPromise, timeoutPromise]).finally(() => clearTimeout(timer));
  }

  private async dispatchAction(wc: AutomationPage, action: ActionDefinition): Promise<unknown> {
    switch (action.type) {
      case 'click':
        return this.clickAction(wc, action);
      case 'input':
        return this.inputAction(wc, action);
      case 'scroll':
        return this.scrollAction(wc, action);
      case 'extract':
        return this.extractAction(wc, action);
      case 'screenshot':
        return this.screenshotAction(wc);
      default:
        throw new Error(`Unknown action type: ${(action as ActionDefinition).type}`);
    }
  }

  private async clickAction(wc: AutomationPage, action: ActionDefinition): Promise<void> {
    const entryUrl = typeof action.params?.entryUrl === 'string' ? action.params.entryUrl.trim() : '';
    if (entryUrl) {
      await wc.executeJavaScript(`window.location.assign(${JSON.stringify(entryUrl)})`);
      return;
    }

    await wc.executeJavaScript(`
      (() => {
        const el = document.querySelector('${escapeCssSelector(action.selector)}');
        if (!el) throw new Error('Element not found: ${escapeCssSelector(action.selector)}');
        el.click();
      })()
    `);
  }

  private async inputAction(wc: AutomationPage, action: ActionDefinition): Promise<void> {
    const value = (action.params?.value as string) ?? '';
    const clear = (action.params?.clear as boolean) ?? true;
    await wc.executeJavaScript(`
      (() => {
        const el = document.querySelector('${escapeCssSelector(action.selector)}');
        if (!el) throw new Error('Element not found: ${escapeCssSelector(action.selector)}');
        if (${clear}) el.value = '';
        el.value += ${JSON.stringify(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
  }

  private async scrollAction(wc: AutomationPage, action: ActionDefinition): Promise<void> {
    const x = (action.params?.x as number) ?? 0;
    const y = (action.params?.y as number) ?? 300;
    await wc.executeJavaScript(`
      (() => {
        const el = document.querySelector('${escapeCssSelector(action.selector)}');
        const target = el || window;
        target.scrollBy(${x}, ${y});
      })()
    `);
  }

  private async extractAction(wc: AutomationPage, action: ActionDefinition): Promise<unknown> {
    if (action.params?.mode === 'api') {
      return this.extractApiAction(action);
    }

    const commentPlatform = resolveCommentParserPlatform(action.params?.parserKey);
    if (commentPlatform) {
      const payload = await wc.executeJavaScript(buildCommentExtractionScript(commentPlatform, action.selector));
      return parseVisibleComments(payload, action.params, commentPlatform);
    }

    const attr = (action.params?.attribute as string) ?? 'textContent';
    return wc.executeJavaScript(`
      (() => {
        const els = document.querySelectorAll('${escapeCssSelector(action.selector)}');
        return Array.from(els).map(el => el.${attr} ?? el.getAttribute('${attr}') ?? '');
      })()
    `);
  }

  private async extractApiAction(action: ActionDefinition): Promise<unknown[]> {
    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Fetch API is not available in this runtime');
    }

    const parserKey = String(action.params?.parserKey ?? '');
    if (parserKey === 'newsnow.batch') {
      return this.extractNewsNowBatchAction(action);
    }

    const response = await fetchWithTimeout(action.selector, {
      headers: buildApiRequestHeaders(action.selector, parserKey),
      timeoutMs: getRequestTimeoutMs(action.params),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    if (parserKey === 'rss.feed') {
      const xml = await response.text();
      return new HotRssParser().parse(xml, action.selector);
    }

    const payload = await response.json();
    if (parserKey === 'newsnow.hot') {
      return parseNewsNowHot(payload, action.selector);
    }

    throw new Error(`Unsupported API parser: ${parserKey || 'unknown'}`);
  }

  private async extractNewsNowBatchAction(action: ActionDefinition): Promise<unknown[]> {
    const platformIds = toStringList(action.params?.platformIds);
    if (platformIds.length === 0) {
      throw new Error('newsnow.batch requires platformIds');
    }

    const timeoutMs = getRequestTimeoutMs(action.params);
    const items: Array<Record<string, unknown>> = [];
    const failures: string[] = [];
    for (const platformId of platformIds) {
      const requestUrl = buildNewsNowPlatformUrl(action.selector, platformId);
      try {
        const response = await fetchWithTimeout(requestUrl, {
          headers: buildApiRequestHeaders(requestUrl, 'newsnow.batch'),
          timeoutMs,
        });

        if (!response.ok) {
          failures.push(`${platformId}: ${response.status} ${response.statusText}`);
          continue;
        }

        const payload = await response.json();
        items.push(...parseNewsNowHot(payload, requestUrl));
      } catch (error) {
        failures.push(`${platformId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (items.length === 0 && failures.length > 0) {
      throw new Error(`API request failed: ${failures.join('; ')}`);
    }

    return items;
  }

  private async screenshotAction(wc: AutomationPage): Promise<string> {
    const image = await wc.capturePage();
    return image.toDataURL();
  }
}

/**
 * 简单 CSS 选择器转义（防注入）
 */
function escapeCssSelector(selector: string): string {
  return selector.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
}

function buildCommentExtractionScript(platform: 'xhs' | 'douyin', selector: string): string {
  if (platform === 'xhs') {
    return `
      (() => {
        const commentSelectors = [
          '.comments-el .comment-item',
          '.comments-container .comment-item',
          '.comment-list .comment-item',
          '[class*="comments"] [class*="comment-item"]',
          '[class*="comment"] [class*="content"]'
        ];
        const els = commentSelectors.flatMap((item) => Array.from(document.querySelectorAll(item)));
        const uniqueEls = Array.from(new Set(els));
        return uniqueEls.map((el, index) => {
          const textEl = el.querySelector('.content, .comment-content, [class*="content"]') || el;
          const authorEl = el.querySelector('.author, .nickname, .name, [class*="author"], [class*="nickname"]');
          const likeEl = el.querySelector('.like, [class*="like"]');
          const anchor = el.closest('a') || el.querySelector('a');
          return {
            id: el.getAttribute('data-id') || el.getAttribute('id') || 'xhs-comment-node-' + (index + 1),
            text: (textEl.textContent || '').trim(),
            nickname: authorEl ? (authorEl.textContent || '').trim() : '',
            likes: likeEl ? (likeEl.textContent || '').trim() : '',
            contentUrl: anchor ? anchor.href : window.location.href
          };
        });
      })()
    `;
  }

  return `
    (() => {
      const els = document.querySelectorAll('${escapeCssSelector(selector)}');
      return Array.from(els).map(el => {
        const text = el.textContent || '';
        const anchor = el.closest('a') || el.querySelector('a');
        return {
          content: text.trim(),
          contentUrl: anchor ? anchor.href : window.location.href
        };
      });
    })()
  `;
}

const DEFAULT_API_REQUEST_TIMEOUT_MS = 30_000;

function getRequestTimeoutMs(params: ActionDefinition['params']): number {
  const raw = params?.timeoutMs;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_API_REQUEST_TIMEOUT_MS;
}

async function fetchWithTimeout(
  input: string,
  init: { headers?: Record<string, string>; timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    return await globalThis.fetch(input, {
      headers: init.headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildApiRequestHeaders(requestUrl: string, parserKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };

  if (parserKey !== 'newsnow.hot' && parserKey !== 'newsnow.batch') {
    return headers;
  }

  try {
    const { origin } = new URL(requestUrl);
    headers.Origin = origin;
    headers.Referer = `${origin}/`;
  } catch {
    headers.Origin = 'https://newsnow.busiyi.world';
    headers.Referer = 'https://newsnow.busiyi.world/';
  }

  return headers;
}

function buildNewsNowPlatformUrl(baseUrl: string, platformId: string): string {
  try {
    const url = new URL(baseUrl);
    const params = new URLSearchParams(url.search);
    params.set('id', platformId);
    params.delete('latest');
    return `${url.origin}${url.pathname}?${params.toString()}&latest`;
  } catch {
    return `https://newsnow.busiyi.world/api/s?id=${encodeURIComponent(platformId)}&latest`;
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function resolveCommentParserPlatform(parserKey: unknown): 'xhs' | 'douyin' | null {
  if (parserKey === 'xhs.comment') return 'xhs';
  if (parserKey === 'douyin.comment') return 'douyin';
  return null;
}

function parseVisibleComments(
  payload: unknown,
  params: ActionDefinition['params'],
  platform: 'xhs' | 'douyin',
): Array<Record<string, unknown>> {
  const rows = Array.isArray(payload) ? payload : [payload];
  const sourceId = typeof params?.sourceId === 'string' ? params.sourceId : undefined;
  return rows
    .map((row, index) => normalizeVisibleComment(row, index, platform, sourceId))
    .filter((row): row is Record<string, unknown> => row !== null);
}

function normalizeVisibleComment(
  value: unknown,
  index: number,
  platform: 'xhs' | 'douyin',
  sourceId?: string,
): Record<string, unknown> | null {
  if (typeof value === 'string') {
    const content = value.trim();
    if (!isValidVisibleCommentContent(content, platform)) return null;
    return {
      platform,
      ...(sourceId ? { sourceId } : {}),
      commentId: `${platform}-visible-comment-${index + 1}`,
      parentCommentId: null,
      content,
    };
  }

  if (!isRecord(value)) return null;
  const content = toNullableString(value.content)
    ?? toNullableString(value.text)
    ?? toNullableString(value.comment)
    ?? '';
  if (!isValidVisibleCommentContent(content, platform)) return null;
  const commentId = toNullableString(value.commentId)
    ?? toNullableString(value.id)
    ?? `${platform}-visible-comment-${index + 1}`;

  return {
    platform,
    ...(sourceId ? { sourceId } : {}),
    ...(toNullableString(value.contentId) ? { contentId: toNullableString(value.contentId) } : {}),
    ...(toNullableString(value.contentUrl) ? { contentUrl: toNullableString(value.contentUrl) } : {}),
    ...(toNullableString(value.contentTitle) ? { contentTitle: toNullableString(value.contentTitle) } : {}),
    commentId,
    parentCommentId: toNullableString(value.parentCommentId),
    content: content.trim(),
    ...(toNullableString(value.authorId) ? { authorId: toNullableString(value.authorId) } : {}),
    ...(toNullableString(value.authorName) ?? toNullableString(value.nickname)
      ? { authorName: toNullableString(value.authorName) ?? toNullableString(value.nickname) }
      : {}),
    ...(toNullableString(value.avatar) ? { avatar: toNullableString(value.avatar) } : {}),
    ...(toNullableString(value.createdAt) ? { createdAt: toNullableString(value.createdAt) } : {}),
    ...(toNumber(value.likeCount ?? value.likes) !== undefined
      ? { likeCount: toNumber(value.likeCount ?? value.likes) }
      : {}),
    ...(toNullableString(value.ipLocation) ? { ipLocation: toNullableString(value.ipLocation) } : {}),
    ...(toNumber(value.subCommentCount) !== undefined ? { subCommentCount: toNumber(value.subCommentCount) } : {}),
  };
}

function isValidVisibleCommentContent(value: string, platform: 'xhs' | 'douyin'): boolean {
  const content = value.trim();
  if (!content) return false;
  if (platform === 'xhs' && content.length > 300) return false;
  if (content.includes('window.__INITIAL_STATE__') || content.includes('window.__SSR__')) return false;
  if (content.includes('沪ICP备') || content.includes('营业执照') || content.includes('增值电信业务经营许可证')) {
    return false;
  }
  if (content.includes('广告屏蔽插件') || content.includes('您的浏览器似乎开启了广告屏蔽插件')) {
    return false;
  }
  if (content.includes('创作中心') && content.includes('业务合作') && content.includes('直播')) {
    return false;
  }
  return true;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

interface NewsNowItem {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  mobileUrl?: unknown;
  pubDate?: unknown;
  extra?: {
    info?: unknown;
  } | null;
}

function parseNewsNowHot(payload: unknown, requestUrl: string): Array<Record<string, unknown>> {
  const sourceId = getNewsNowSourceId(payload, requestUrl);
  const updatedTime = formatNewsNowTime(getRecordValue(payload, 'updatedTime'));
  const items = getNewsNowItems(payload);

  return items.map((item, index) => ({
    itemId: toNullableString(item.id),
    title: toNullableString(item.title) ?? '',
    url: toNullableString(item.url),
    mobileUrl: toNullableString(item.mobileUrl),
    rank: index + 1,
    sourceId,
    updatedTime,
    heat: toNullableString(item.extra?.info),
    ...(toNullableString(item.pubDate) ? { pubDate: toNullableString(item.pubDate) } : {}),
  }));
}

function getNewsNowItems(payload: unknown): NewsNowItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord) as NewsNowItem[];
  }

  if (!isRecord(payload)) {
    return [];
  }

  const items = payload.items;
  if (Array.isArray(items)) {
    return items.filter(isRecord) as NewsNowItem[];
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items.filter(isRecord) as NewsNowItem[];
  }

  return [];
}

function getNewsNowSourceId(payload: unknown, requestUrl: string): string | null {
  const payloadId = toNullableString(getRecordValue(payload, 'id'));
  if (payloadId) {
    return payloadId;
  }

  try {
    return new URL(requestUrl).searchParams.get('id');
  } catch {
    return null;
  }
}

function formatNewsNowTime(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue < 10_000_000_000 ? numericValue * 1000 : numericValue)
    : new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getRecordValue(record: unknown, key: string): unknown {
  return isRecord(record) ? record[key] : undefined;
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
