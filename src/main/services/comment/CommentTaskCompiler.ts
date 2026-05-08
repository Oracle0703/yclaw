import type { CommentCrawlLimits, CommentFilterConfig, CommentSource, TaskFlow, TaskStep } from '@shared/types';

export const DEFAULT_COMMENT_LIMITS: CommentCrawlLimits = {
  maxContents: 5,
  maxCommentsPerContent: 20,
  includeSubComments: false,
  crawlIntervalSeconds: 2,
};

type CommentTaskSource = Pick<
  CommentSource,
  | 'id'
  | 'name'
  | 'platform'
  | 'entryKind'
  | 'entryValue'
  | 'parserKey'
  | 'sessionId'
  | 'schedule'
  | 'limits'
  | 'filter'
  | 'enabled'
  | 'tags'
>;

export class CommentTaskCompiler {
  compile(source: CommentTaskSource): Pick<TaskFlow, 'name' | 'description' | 'entryUrl' | 'schedule' | 'sessionId' | 'enabled' | 'tags' | 'steps'> {
    const entryUrl = this.resolveEntryUrl(source);
    return {
      name: source.name,
      description: `${source.platform} · ${source.parserKey} 评论源`,
      entryUrl,
      schedule: source.schedule ?? { type: 'manual' },
      sessionId: source.sessionId ?? null,
      enabled: source.enabled,
      tags: this.buildTags(source.tags),
      steps: [
        this.buildOpenStep(source, entryUrl),
        this.buildExtractStep(source),
        {
          id: `${source.platform}-comment-screenshot`,
          name: '记录评论页面截图',
          action: {
            type: 'screenshot',
            selector: 'body',
          },
        },
      ],
    };
  }

  private resolveEntryUrl(source: CommentTaskSource): string {
    if (source.entryKind === 'keyword') {
      if (source.platform === 'douyin') {
        return `https://www.douyin.com/search/${encodeURIComponent(source.entryValue)}?type=general`;
      }
      return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(source.entryValue)}`;
    }
    return source.entryValue;
  }

  private buildOpenStep(source: CommentTaskSource, entryUrl: string): TaskStep {
    const names = source.platform === 'douyin'
      ? {
        keyword: '打开抖音搜索页',
        note: '打开指定视频',
        creator: '打开抖音主页',
      } as const
      : {
        keyword: '打开小红书搜索页',
        note: '打开指定笔记',
        creator: '打开创作者主页',
      } as const;
    return {
      id: `${source.platform}-open-${source.entryKind}`,
      name: names[source.entryKind],
      action: {
        type: 'click',
        selector: 'body',
        params: {
          entryUrl,
          platform: source.platform,
          entryKind: source.entryKind,
          parserKey: source.parserKey,
        },
      },
    };
  }

  private buildExtractStep(source: CommentTaskSource): TaskStep {
    return {
      id: `${source.platform}-extract-comments`,
      name: '提取评论数据',
      action: {
        type: 'extract',
        selector: 'body',
        params: {
          parserKey: source.parserKey,
          sourceId: source.id,
          platform: source.platform,
          entryKind: source.entryKind,
          entryValue: source.entryValue,
          limits: source.limits,
          ...(source.filter ? { filter: source.filter satisfies CommentFilterConfig } : {}),
        },
      },
    };
  }

  private buildTags(tags: string[] = []): string[] {
    return Array.from(new Set([...tags, 'comment-monitor']));
  }
}
