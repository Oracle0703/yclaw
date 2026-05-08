import { describe, expect, it } from 'vitest';

import { CommentTaskCompiler } from '@main/services/comment/CommentTaskCompiler';

describe('CommentTaskCompiler', () => {
  it('compiles Xiaohongshu keyword sources into browser extract steps', () => {
    const flow = new CommentTaskCompiler().compile({
      id: 'source-1',
      name: '小红书副业评论',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: '编程副业',
      parserKey: 'xhs.comment',
      limits: {
        maxContents: 3,
        maxCommentsPerContent: 10,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
      filter: { includeKeywords: ['价格'] },
      enabled: true,
      tags: ['评论'],
    });

    expect(flow.entryUrl).toBe('https://www.xiaohongshu.com/search_result?keyword=%E7%BC%96%E7%A8%8B%E5%89%AF%E4%B8%9A');
    expect(flow.steps[0]).toMatchObject({
      id: 'xhs-open-keyword',
      name: '打开小红书搜索页',
      action: {
        type: 'click',
        selector: 'body',
        params: expect.objectContaining({ entryKind: 'keyword' }),
      },
    });
    expect(flow.steps[1]).toMatchObject({
      id: 'xhs-extract-comments',
      action: {
        type: 'extract',
        selector: 'body',
        params: {
          parserKey: 'xhs.comment',
          sourceId: 'source-1',
          platform: 'xhs',
          entryKind: 'keyword',
          entryValue: '编程副业',
          limits: {
            maxContents: 3,
            maxCommentsPerContent: 10,
            includeSubComments: false,
            crawlIntervalSeconds: 2,
          },
          filter: { includeKeywords: ['价格'] },
        },
      },
    });
  });

  it('compiles note and creator entry kinds with stable entry urls', () => {
    const compiler = new CommentTaskCompiler();

    expect(compiler.compile({
      id: 'source-note',
      name: '指定笔记评论',
      platform: 'xhs',
      entryKind: 'note',
      entryValue: 'https://www.xiaohongshu.com/explore/abc',
      parserKey: 'xhs.comment',
      limits: {
        maxContents: 1,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
      enabled: true,
      tags: [],
    }).steps[0].name).toBe('打开指定笔记');

    expect(compiler.compile({
      id: 'source-creator',
      name: '创作者评论',
      platform: 'xhs',
      entryKind: 'creator',
      entryValue: 'https://www.xiaohongshu.com/user/profile/u1',
      parserKey: 'xhs.comment',
      limits: {
        maxContents: 5,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
      enabled: true,
      tags: [],
    }).steps[0].name).toBe('打开创作者主页');
  });

  it('compiles Douyin keyword sources into Douyin comment extract steps', () => {
    const flow = new CommentTaskCompiler().compile({
      id: 'source-douyin',
      name: '抖音 AI 评论',
      platform: 'douyin',
      entryKind: 'keyword',
      entryValue: 'AI工具',
      parserKey: 'douyin.comment',
      limits: {
        maxContents: 3,
        maxCommentsPerContent: 10,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
      enabled: true,
      tags: ['抖音'],
    });

    expect(flow.entryUrl).toBe('https://www.douyin.com/search/AI%E5%B7%A5%E5%85%B7?type=general');
    expect(flow.steps[0]).toMatchObject({
      id: 'douyin-open-keyword',
      name: '打开抖音搜索页',
      action: {
        type: 'click',
        selector: 'body',
        params: expect.objectContaining({
          entryUrl: 'https://www.douyin.com/search/AI%E5%B7%A5%E5%85%B7?type=general',
          platform: 'douyin',
          parserKey: 'douyin.comment',
        }),
      },
    });
    expect(flow.steps[1]).toMatchObject({
      id: 'douyin-extract-comments',
      action: {
        type: 'extract',
        selector: 'body',
        params: expect.objectContaining({
          parserKey: 'douyin.comment',
          sourceId: 'source-douyin',
          platform: 'douyin',
        }),
      },
    });
  });
});
