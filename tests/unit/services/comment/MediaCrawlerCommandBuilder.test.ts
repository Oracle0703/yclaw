import { describe, expect, it } from 'vitest';

import { buildMediaCrawlerCommand } from '@main/services/comment/MediaCrawlerCommandBuilder';
import type { MediaCrawlerConfig, MediaCrawlerPlatform } from '@shared/types';

const config: MediaCrawlerConfig = {
  enabled: true,
  repoPath: 'E:/MediaCrawler',
  pythonPath: 'python',
  outputDir: 'E:/MediaCrawler/data',
  loginType: 'qrcode',
};

describe('MediaCrawlerCommandBuilder', () => {
  it('maps all MediaCrawler platforms to CLI arguments', () => {
    const platforms: MediaCrawlerPlatform[] = ['xhs', 'dy', 'ks', 'bili', 'wb', 'tieba', 'zhihu'];

    for (const platform of platforms) {
      const command = buildMediaCrawlerCommand(config, {
        sourceId: 'source-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        platform,
        entryKind: 'keyword',
        entryValue: 'AI工具',
        limits: {
          maxContents: 5,
          maxCommentsPerContent: 20,
          includeSubComments: false,
          crawlIntervalSeconds: 2,
        },
      });

      expect(command.command).toBe('python');
      expect(command.cwd).toBe('E:/MediaCrawler');
      expect(command.args).toEqual(expect.arrayContaining(['main.py', '--platform', platform]));
      expect(command.args).toEqual(expect.arrayContaining(['--lt', 'qrcode', '--type', 'search']));
      expect(command.env.MEDIA_CRAWLER_KEYWORD).toBe('AI工具');
      expect(command.outputDir).toBe('E:/MediaCrawler/data');
    }
  });

  it('maps note and creator entries to detail and creator commands', () => {
    const detail = buildMediaCrawlerCommand(config, {
      sourceId: 'source-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      platform: 'xhs',
      entryKind: 'note',
      entryValue: 'https://www.xiaohongshu.com/explore/abc',
      limits: {
        maxContents: 1,
        maxCommentsPerContent: 20,
        includeSubComments: true,
        crawlIntervalSeconds: 2,
      },
    });
    const creator = buildMediaCrawlerCommand(config, {
      sourceId: 'source-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      platform: 'xhs',
      entryKind: 'creator',
      entryValue: 'creator-1',
      limits: {
        maxContents: 5,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
    });

    expect(detail.args).toEqual(expect.arrayContaining(['--type', 'detail']));
    expect(detail.env.MEDIA_CRAWLER_DETAIL_ID_LIST).toBe('https://www.xiaohongshu.com/explore/abc');
    expect(detail.env.MEDIA_CRAWLER_ENABLE_GET_SUB_COMMENTS).toBe('true');
    expect(creator.args).toEqual(expect.arrayContaining(['--type', 'creator']));
    expect(creator.env.MEDIA_CRAWLER_CREATOR_ID_LIST).toBe('creator-1');
  });
});
