import { describe, expect, it } from 'vitest';

import { HotTaskCompiler } from '@main/services/hot/HotTaskCompiler';

describe('HotTaskCompiler', () => {
  it('compiles NewsNow API sources into API extract steps', () => {
    const compiler = new HotTaskCompiler();

    const flow = compiler.compile({
      name: '知乎热榜',
      sourceKind: 'api',
      siteKey: 'newsnow',
      entryUrl: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
      parserKey: 'newsnow.hot',
      schedule: { type: 'manual' },
      enabled: true,
      tags: ['热点'],
    });

    expect(flow.entryUrl).toBe('https://newsnow.busiyi.world/api/s?id=zhihu&latest');
    expect(flow.steps[0]).toEqual({
      id: 'newsnow-request',
      name: '请求 API 数据',
      action: {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        params: { parserKey: 'newsnow.hot', mode: 'api' },
      },
    });
  });

  it('compiles TrendRadar batch sources into one multi-platform API extract step', () => {
    const compiler = new HotTaskCompiler();

    const flow = compiler.compile({
      name: 'TrendRadar 多平台热榜',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/api/s',
      parserKey: 'newsnow.batch',
      platformIds: ['toutiao', 'baidu', 'weibo', 'douyin', 'zhihu'],
      schedule: { type: 'manual' },
      enabled: true,
      tags: ['TrendRadar'],
    });

    expect(flow.steps[0]).toEqual({
      id: 'trendradar-request',
      name: '请求多平台 API 数据',
      action: {
        type: 'extract',
        selector: 'https://newsnow.busiyi.world/api/s',
        params: {
          parserKey: 'newsnow.batch',
          mode: 'api',
          platformIds: ['toutiao', 'baidu', 'weibo', 'douyin', 'zhihu'],
        },
      },
    });
  });

  it('compiles RSS sources with filter and timeline metadata', () => {
    const compiler = new HotTaskCompiler();

    const flow = compiler.compile({
      name: '科技 RSS',
      sourceKind: 'rss',
      siteKey: 'rss',
      entryUrl: 'https://example.com/feed.xml',
      parserKey: 'rss.feed',
      schedule: { type: 'cron', cron: '*/30 * * * *' },
      filter: {
        keywordGroups: [{ name: 'AI', include: ['AI', '芯片'] }],
      },
      timeline: {
        preset: 'workday',
        windows: [{ start: '09:00', end: '18:00', daysOfWeek: [1, 2, 3, 4, 5] }],
      },
    });

    expect(flow.steps[0]).toEqual({
      id: 'rss-request',
      name: '请求 RSS 数据',
      action: {
        type: 'extract',
        selector: 'https://example.com/feed.xml',
        params: {
          parserKey: 'rss.feed',
          mode: 'api',
          filter: {
            keywordGroups: [{ name: 'AI', include: ['AI', '芯片'] }],
          },
        },
      },
    });
    expect(flow.tags).toContain('hot:rss');
  });
});
