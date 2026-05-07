import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationEngine } from '@engines/automation/AutomationEngine';
import type { ActionDefinition } from '@engines/automation/types';

interface MockWebContents {
  executeJavaScript: ReturnType<typeof vi.fn>;
  capturePage: ReturnType<typeof vi.fn>;
}

function createMockWebContents(): MockWebContents {
  return {
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    capturePage: vi.fn().mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,mockImageData',
    }),
  };
}

describe('AutomationEngine', () => {
  let engine: AutomationEngine;
  let wc: ReturnType<typeof createMockWebContents>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    engine = new AutomationEngine();
    wc = createMockWebContents();
  });

  describe('click action', () => {
    it('should execute click on selector', async () => {
      const action: ActionDefinition = { type: 'click', selector: '#btn' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.actionType).toBe('click');
      expect(wc.executeJavaScript).toHaveBeenCalled();
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('#btn');
      expect(script).toContain('.click()');
    });

    it('should return failure when element not found', async () => {
      wc.executeJavaScript.mockRejectedValueOnce(new Error('Element not found: #missing'));
      const action: ActionDefinition = { type: 'click', selector: '#missing' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });
  });

  describe('input action', () => {
    it('should input value into element', async () => {
      const action: ActionDefinition = {
        type: 'input',
        selector: '#name',
        params: { value: 'Hello World', clear: true },
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.actionType).toBe('input');
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('#name');
      expect(script).toContain('Hello World');
    });

    it('should default clear to true', async () => {
      const action: ActionDefinition = {
        type: 'input',
        selector: '#field',
        params: { value: 'test' },
      };
      await engine.execute(wc, action);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('true');
    });
  });

  describe('scroll action', () => {
    it('should scroll with default values', async () => {
      const action: ActionDefinition = { type: 'scroll', selector: 'body' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('scrollBy');
    });

    it('should scroll with custom x/y', async () => {
      const action: ActionDefinition = {
        type: 'scroll',
        selector: '.container',
        params: { x: 100, y: 500 },
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('100');
      expect(script).toContain('500');
    });
  });

  describe('extract action', () => {
    it('should extract text content by default', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(['text1', 'text2']);
      const action: ActionDefinition = { type: 'extract', selector: '.item' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['text1', 'text2']);
    });

    it('should extract specified attribute', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(['href1']);
      const action: ActionDefinition = {
        type: 'extract',
        selector: 'a',
        params: { attribute: 'href' },
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('href');
    });

    it('persists extraction results after successful extract step', async () => {
      const saveResult = vi.fn();
      wc.executeJavaScript.mockResolvedValueOnce(['text1', 'text2']);
      engine = new AutomationEngine({
        resultService: {
          saveResult,
        } as never,
      });
      const action: ActionDefinition = { type: 'extract', selector: '.item' };

      await engine.execute(wc, action, {
        taskId: 'task-1',
        batchId: 'batch-1',
        templateId: 'template-1',
        sourceUrl: 'https://example.com',
      });

      expect(saveResult).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          batchId: 'batch-1',
          templateId: 'template-1',
          data: expect.any(Object),
        }),
      );
    });

    it('fetches and parses NewsNow API extracts without running a DOM selector', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'zhihu',
            updatedTime: 1777680000000,
            items: [
              {
                id: 'item-1',
                title: '知乎热点 1',
                url: 'https://www.zhihu.com/question/1',
                mobileUrl: 'https://www.zhihu.com/question/1',
                extra: { info: '123 万热度' },
              },
              {
                title: '知乎热点 2',
                url: 'https://www.zhihu.com/question/2',
              },
            ],
          }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await engine.execute(wc, {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        params: { mode: 'api', parserKey: 'newsnow.hot' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          itemId: 'item-1',
          title: '知乎热点 1',
          url: 'https://www.zhihu.com/question/1',
          mobileUrl: 'https://www.zhihu.com/question/1',
          rank: 1,
          sourceId: 'zhihu',
          updatedTime: '2026-05-02T00:00:00.000Z',
          heat: '123 万热度',
        },
        {
          itemId: null,
          title: '知乎热点 2',
          url: 'https://www.zhihu.com/question/2',
          mobileUrl: null,
          rank: 2,
          sourceId: 'zhihu',
          updatedTime: '2026-05-02T00:00:00.000Z',
          heat: null,
        },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        expect.objectContaining({ headers: expect.any(Object) }),
      );
      expect(wc.executeJavaScript).not.toHaveBeenCalled();
    });

    it('sends browser-like headers for NewsNow API extracts', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'zhihu',
            items: [],
          }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await engine.execute(wc, {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        params: { mode: 'api', parserKey: 'newsnow.hot' },
      });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'User-Agent': expect.stringContaining('Mozilla/5.0'),
            Referer: 'https://newsnow.busiyi.world/',
            Origin: 'https://newsnow.busiyi.world',
          }),
        }),
      );
    });

    it('fetches and merges NewsNow batch extracts for multiple TrendRadar platforms', async () => {
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        const sourceId = url.searchParams.get('id') ?? 'unknown';
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              id: sourceId,
              items: [
                {
                  title: `${sourceId} 热点`,
                  url: `https://example.com/${sourceId}`,
                },
              ],
            }),
        };
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await engine.execute(wc, {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s',
        params: {
          mode: 'api',
          parserKey: 'newsnow.batch',
          platformIds: ['toutiao', 'baidu'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        expect.objectContaining({
          title: 'toutiao 热点',
          sourceId: 'toutiao',
          rank: 1,
        }),
        expect.objectContaining({
          title: 'baidu 热点',
          sourceId: 'baidu',
          rank: 1,
        }),
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://newsnow.busiyi.world/api/s?id=toutiao&latest',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla/5.0'),
            Referer: 'https://newsnow.busiyi.world/',
            Origin: 'https://newsnow.busiyi.world',
          }),
        }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://newsnow.busiyi.world/api/s?id=baidu&latest',
        expect.objectContaining({ headers: expect.any(Object) }),
      );
      expect(wc.executeJavaScript).not.toHaveBeenCalled();
    });

    it('keeps successful NewsNow batch items when one platform request fails', async () => {
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        const sourceId = url.searchParams.get('id') ?? 'unknown';
        if (sourceId === 'douyin') {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          };
        }
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              id: sourceId,
              items: [
                {
                  title: `${sourceId} 热点`,
                  url: `https://example.com/${sourceId}`,
                },
              ],
            }),
        };
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await engine.execute(wc, {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s',
        params: {
          mode: 'api',
          parserKey: 'newsnow.batch',
          platformIds: ['baidu', 'douyin', 'zhihu'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        expect.objectContaining({ title: 'baidu 热点', sourceId: 'baidu' }),
        expect.objectContaining({ title: 'zhihu 热点', sourceId: 'zhihu' }),
      ]);
    });

    it('persists each NewsNow API item as an extraction result', async () => {
      const saveResult = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'weibo',
              items: [
                { title: '微博热点 1', url: 'https://weibo.com/1' },
                { title: '微博热点 2', url: 'https://weibo.com/2' },
              ],
            }),
        }),
      );
      engine = new AutomationEngine({
        resultService: {
          saveResult,
        } as never,
      });

      await engine.execute(
        wc,
        {
          type: 'extract',
          selector: 'https://newsnow.busiyi.world/api/s?id=weibo&latest',
          params: { mode: 'api', parserKey: 'newsnow.hot' },
        },
        {
          taskId: 'task-1',
          batchId: 'batch-1',
          sourceUrl: 'https://newsnow.busiyi.world/api/s?id=weibo&latest',
        },
      );

      expect(saveResult).toHaveBeenCalledTimes(2);
      expect(saveResult).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          taskId: 'task-1',
          batchId: 'batch-1',
          data: expect.objectContaining({
            title: '微博热点 1',
            rank: 1,
            sourceId: 'weibo',
          }),
        }),
      );
      expect(saveResult).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          taskId: 'task-1',
          batchId: 'batch-1',
          data: expect.objectContaining({
            title: '微博热点 2',
            rank: 2,
            sourceId: 'weibo',
          }),
        }),
      );
    });

    it('fetches RSS feeds and applies keyword filtering before persistence', async () => {
      const saveResult = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: () =>
            Promise.resolve(`
          <rss><channel><title>财经 RSS</title>
            <item>
              <title>AI 芯片投资升温</title>
              <link>https://example.com/ai-chip</link>
              <guid>ai-chip</guid>
            </item>
            <item>
              <title>娱乐热点</title>
              <link>https://example.com/fun</link>
            </item>
          </channel></rss>
        `),
        }),
      );
      engine = new AutomationEngine({
        resultService: {
          saveResult,
        } as never,
      });

      const result = await engine.execute(
        wc,
        {
          type: 'extract',
          selector: 'https://example.com/feed.xml',
          params: {
            mode: 'api',
            parserKey: 'rss.feed',
            filter: {
              keywordGroups: [{ name: 'AI', include: ['AI', '芯片'] }],
            },
          },
        },
        {
          taskId: 'task-1',
          batchId: 'batch-1',
          sourceUrl: 'https://example.com/feed.xml',
        },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        expect.objectContaining({
          title: 'AI 芯片投资升温',
          url: 'https://example.com/ai-chip',
          keywordGroups: ['AI'],
          isNew: true,
        }),
      ]);
      expect(saveResult).toHaveBeenCalledTimes(1);
      expect(wc.executeJavaScript).not.toHaveBeenCalled();
    });

    it('aborts API extracts that exceed the configured timeout', async () => {
      const fetchMock = vi.fn((_input: string, init?: { signal?: AbortSignal }) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await engine.execute(wc, {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        params: { mode: 'api', parserKey: 'newsnow.hot', timeoutMs: 5 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws an aggregated API error when all NewsNow batch platforms fail', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      const result = await engine.execute(wc, {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s',
        params: {
          mode: 'api',
          parserKey: 'newsnow.batch',
          platformIds: ['baidu', 'douyin'],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('baidu: 500');
      expect(result.error).toContain('douyin: 500');
    });

    it('rejects newsnow.batch extracts without platform ids', async () => {
      vi.stubGlobal('fetch', vi.fn());

      const result = await engine.execute(wc, {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s',
        params: { mode: 'api', parserKey: 'newsnow.batch' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('newsnow.batch requires platformIds');
    });
  });

  describe('screenshot action', () => {
    it('should capture page as data URL', async () => {
      const action: ActionDefinition = { type: 'screenshot', selector: '' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.data).toBe('data:image/png;base64,mockImageData');
      expect(wc.capturePage).toHaveBeenCalled();
    });
  });

  describe('timeout', () => {
    it('should timeout after specified duration', async () => {
      wc.executeJavaScript.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );
      const action: ActionDefinition = {
        type: 'click',
        selector: '#slow',
        timeout: 50,
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });
  });

  describe('unknown action type', () => {
    it('should return error for unknown type', async () => {
      const action = { type: 'unknown', selector: '#x' } as unknown as ActionDefinition;
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action type');
    });
  });

  describe('result shape', () => {
    it('should include duration in result', async () => {
      const action: ActionDefinition = { type: 'click', selector: '#btn' };
      const result = await engine.execute(wc, action);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.stepId).toBe('');
    });
  });
});
