import { describe, expect, it } from 'vitest';
import {
  buildDouyinSearchResults,
  buildDouyinInsight,
  buildDouyinReviewQueueNote,
  createInitialDownloadRequest,
  confirmDownloadAuthorization,
  markDownloadStarted,
  markDownloadCompleted,
} from '@renderer/entries/browser/douyin/workspace';

describe('douyin workspace helpers', () => {
  it('builds deterministic search results from the keyword', () => {
    const results = buildDouyinSearchResults('夏季穿搭');

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      id: 'douyin-search-1',
      title: expect.stringContaining('夏季穿搭'),
      authorName: expect.any(String),
      url: expect.stringContaining('douyin.com/video/'),
    });
  });

  it('builds insight fields from current title and comment samples', () => {
    const insight = buildDouyinInsight({
      title: '夏季穿搭避坑视频',
      commentSamples: ['这条总结很实用', '想看平替推荐', '价格太高了'],
    });

    expect(insight.summary).toContain('夏季穿搭避坑视频');
    expect(insight.keywords.length).toBeGreaterThan(0);
    expect(insight.sentiment).toBe('mixed');
    expect(insight.riskFlags.length).toBeGreaterThan(0);
  });

  it('adds the current target title and url into review queue notes', () => {
    const note = buildDouyinReviewQueueNote({
      actionTitle: '评论草稿生成后人工确认再发送',
      targetTitle: '夏季穿搭避坑视频',
      targetUrl: 'https://www.douyin.com/video/1001',
      workspaceNote: '先保留品牌名，不要直接下结论',
    });

    expect(note).toContain('夏季穿搭避坑视频');
    expect(note).toContain('https://www.douyin.com/video/1001');
    expect(note).toContain('先保留品牌名');
  });

  it('advances the download state machine through confirmation and completion', () => {
    const initial = createInitialDownloadRequest('douyin-search-1');
    const authorized = confirmDownloadAuthorization(initial, true, '2026-04-27 10:00');
    const started = markDownloadStarted(authorized);
    const completed = markDownloadCompleted(started, '/downloads/douyin-1001.mp4');

    expect(initial.status).toBe('idle');
    expect(authorized).toMatchObject({
      targetId: 'douyin-search-1',
      authorized: true,
      status: 'ready',
      confirmedAt: '2026-04-27 10:00',
    });
    expect(started.status).toBe('downloading');
    expect(completed).toMatchObject({
      status: 'done',
      savedPath: '/downloads/douyin-1001.mp4',
    });
  });
});
