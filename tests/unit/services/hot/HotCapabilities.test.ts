import { describe, expect, it, vi } from 'vitest';

import { HotAiInsightService } from '@main/services/hot/HotAiInsightService';
import { HotFilterService } from '@main/services/hot/HotFilterService';
import { HotNotificationService } from '@main/services/hot/HotNotificationService';
import { HotRssParser } from '@main/services/hot/HotRssParser';
import { HotTimelineScheduler } from '@main/services/hot/HotTimelineScheduler';
import type { ExtractionResult } from '@shared/types';

describe('hot capabilities P2-P7', () => {
  const rssXml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <title>示例 RSS</title>
        <item>
          <title>AI 芯片投资升温</title>
          <link>https://example.com/ai-chip</link>
          <guid>ai-chip</guid>
          <pubDate>Wed, 06 May 2026 09:00:00 GMT</pubDate>
          <description>半导体和 AI 基建热度上升</description>
        </item>
        <item>
          <title>体育快讯</title>
          <link>https://example.com/sports</link>
          <guid>sports</guid>
        </item>
      </channel>
    </rss>`;

  it('P2 parses RSS items into normalized hot records', () => {
    const parser = new HotRssParser();

    expect(parser.parse(rssXml, 'https://example.com/feed.xml')).toEqual([
      {
        itemId: 'ai-chip',
        title: 'AI 芯片投资升温',
        url: 'https://example.com/ai-chip',
        mobileUrl: null,
        rank: 1,
        sourceId: 'rss:example.com',
        sourceName: '示例 RSS',
        updatedTime: '2026-05-06T09:00:00.000Z',
        heat: null,
        summary: '半导体和 AI 基建热度上升',
      },
      {
        itemId: 'sports',
        title: '体育快讯',
        url: 'https://example.com/sports',
        mobileUrl: null,
        rank: 2,
        sourceId: 'rss:example.com',
        sourceName: '示例 RSS',
        updatedTime: null,
        heat: null,
        summary: null,
      },
    ]);
  });

  it('P3 filters hot records by keyword groups, excludes blocked terms and marks new items', () => {
    const service = new HotFilterService();

    const filtered = service.apply(
      [
        { title: 'AI 芯片投资升温', url: 'https://example.com/ai-chip' },
        { title: 'AI 广告软文', url: 'https://example.com/ad' },
        { title: '体育快讯', url: 'https://example.com/sports' },
      ],
      {
        keywordGroups: [{ name: 'AI', include: ['AI', '芯片'], exclude: ['广告'] }],
        seenUrls: ['https://example.com/sports'],
      },
    );

    expect(filtered).toEqual([
      {
        title: 'AI 芯片投资升温',
        url: 'https://example.com/ai-chip',
        keywordGroups: ['AI'],
        isNew: true,
      },
    ]);
  });

  it('supports required keywords and maxItems on keyword groups', () => {
    const service = new HotFilterService();

    const filtered = service.apply(
      [
        { title: 'AI 芯片投资升温', url: 'https://example.com/ai-chip' },
        { title: 'AI 产品发布', url: 'https://example.com/ai-product' },
      ],
      {
        keywordGroups: [{ name: 'AI 基建', include: ['AI'], required: ['芯片'], maxItems: 5 }],
      },
    );

    expect(filtered).toEqual([
      expect.objectContaining({
        title: 'AI 芯片投资升温',
        keywordGroups: ['AI 基建'],
      }),
    ]);
  });

  it('requires mandatory keywords inside a keyword group before matching', () => {
    const service = new HotFilterService();

    const filtered = service.apply(
      [
        { title: 'AI 芯片投资升温', url: 'https://example.com/ai-chip' },
        { title: 'AI 产品发布', url: 'https://example.com/ai-product' },
      ],
      {
        keywordGroups: [{ name: 'AI 基建', include: ['AI'], required: ['芯片'] }],
      },
    );

    expect(filtered).toEqual([
      expect.objectContaining({
        title: 'AI 芯片投资升温',
        keywordGroups: ['AI 基建'],
      }),
    ]);
  });

  it('P4 resolves TrendRadar-style timeline presets to schedule windows', () => {
    const scheduler = new HotTimelineScheduler();

    expect(scheduler.resolvePreset('workday')).toEqual({
      preset: 'workday',
      windows: [
        { start: '09:00', end: '12:00', daysOfWeek: [1, 2, 3, 4, 5] },
        { start: '13:30', end: '18:30', daysOfWeek: [1, 2, 3, 4, 5] },
      ],
      schedule: { type: 'cron', cron: '*/30 9-18 * * 1-5' },
    });
    expect(scheduler.listPresets().map((preset) => preset.label)).toEqual([
      '全天',
      '早晚高峰',
      '工作日',
      '自定义',
    ]);
  });

  it('P5 builds an AI hot insight from matching results', async () => {
    const service = new HotAiInsightService({
      aiClient: {
        summarize: vi.fn(async ({ prompt }) => `摘要:${prompt.includes('AI 芯片投资升温')}`),
      },
    });

    const insight = await service.summarize({
      interest: '关注 AI 基建和半导体',
      results: [makeResult('result-1', { title: 'AI 芯片投资升温', keywordGroups: ['AI'] })],
    });

    expect(insight.summary).toBe('摘要:true');
    expect(insight.prompt).toContain('关注 AI 基建和半导体');
    expect(insight.matchedResultIds).toEqual(['result-1']);
  });

  it('P7 sends hot notifications through a delivery adapter', async () => {
    const deliver = vi.fn(async () => ({ status: 'succeeded' as const }));
    const service = new HotNotificationService({ deliver });

    const result = await service.sendReport({
      target: { type: 'webhook', url: 'https://hooks.example.com/hot' },
      report: {
        id: 'report-1',
        sourceId: 'source-1',
        batchId: 'batch-1',
        title: '热点日报',
        format: 'md',
        filePath: '/tmp/report.md',
        createdAt: '2026-05-06T10:00:00.000Z',
      },
      results: [makeResult('result-1', { title: 'AI 芯片投资升温' })],
    });

    expect(result).toEqual({ status: 'succeeded', attempts: 1 });
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://hooks.example.com/hot',
        payload: expect.objectContaining({
          event: 'hot.report.generated',
          resultCount: 1,
        }),
      }),
    );
  });

  it('P7 retries hot notification delivery up to maxRetries before failing', async () => {
    const deliver = vi
      .fn()
      .mockResolvedValueOnce({ status: 'failed', error: 'network down' })
      .mockResolvedValueOnce({ status: 'failed', error: 'still down' })
      .mockResolvedValueOnce({ status: 'failed', error: 'final boom' });
    const service = new HotNotificationService({ deliver });

    const result = await service.sendReport({
      target: { type: 'webhook', url: 'https://hooks.example.com/hot', maxRetries: 3 },
      report: {
        id: 'report-1',
        sourceId: 'source-1',
        batchId: 'batch-1',
        title: '热点日报',
        format: 'md',
        filePath: '/tmp/report.md',
        createdAt: '2026-05-06T10:00:00.000Z',
      },
      results: [],
    });

    expect(deliver).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ status: 'failed', attempts: 3, error: 'final boom' });
  });

  it('P2 derives distinct sourceId for RSS feeds based on host', () => {
    const parser = new HotRssParser();
    const a = parser.parse(
      '<?xml version="1.0"?><rss><channel><title>A</title><item><title>x</title><link>https://a.com/1</link></item></channel></rss>',
      'https://a.example.com/feed.xml',
    );
    const b = parser.parse(
      '<?xml version="1.0"?><rss><channel><title>B</title><item><title>y</title><link>https://b.com/1</link></item></channel></rss>',
      'https://b.example.com/feed.xml',
    );

    expect(a[0]?.sourceId).toBe('rss:a.example.com');
    expect(b[0]?.sourceId).toBe('rss:b.example.com');
    expect(a[0]?.sourceId).not.toBe(b[0]?.sourceId);
  });
});

function makeResult(id: string, data: Record<string, unknown>): ExtractionResult {
  return {
    id,
    taskId: 'task-1',
    batchId: 'batch-1',
    data,
    status: 'normal',
    createdAt: '2026-05-06T10:00:00.000Z',
  };
}
