import type { HotSourceDraft, TaskFlow, TaskStep } from '@shared/types';

export class HotTaskCompiler {
  compile(source: HotSourceDraft): Pick<TaskFlow, 'name' | 'description' | 'entryUrl' | 'schedule' | 'sessionId' | 'enabled' | 'tags' | 'steps'> {
    return {
      name: source.name,
      description: `${source.siteKey} · ${source.parserKey} 采集源`,
      entryUrl: source.entryUrl,
      schedule: source.schedule ?? { type: 'manual' },
      sessionId: source.sessionId ?? null,
      enabled: source.enabled ?? true,
      tags: this.buildTags(source),
      steps: source.sourceKind === 'browser'
        ? this.buildBrowserSteps(source)
        : this.buildApiSteps(source),
    };
  }

  private buildBrowserSteps(source: HotSourceDraft): TaskStep[] {
    return [
      {
        id: `${source.siteKey}-open`,
        name: '打开目标页面',
        action: {
          type: 'click',
          selector: 'body',
          params: { entryUrl: source.entryUrl, parserKey: source.parserKey },
        },
      },
      {
        id: `${source.siteKey}-extract`,
        name: '提取页面热点数据',
        action: {
          type: 'extract',
          selector: 'body',
          params: { parserKey: source.parserKey },
        },
      },
      {
        id: `${source.siteKey}-screenshot`,
        name: '记录页面截图',
        action: {
          type: 'screenshot',
          selector: 'body',
        },
      },
    ];
  }

  private buildApiSteps(source: HotSourceDraft): TaskStep[] {
    const isRss = source.sourceKind === 'rss' || source.parserKey === 'rss.feed';
    const isBatch = source.parserKey === 'newsnow.batch';
    return [
      {
        id: `${source.siteKey}-request`,
        name: isRss ? '请求 RSS 数据' : isBatch ? '请求多平台 API 数据' : '请求 API 数据',
        action: {
          type: 'extract',
          selector: source.entryUrl,
          params: {
            parserKey: source.parserKey,
            mode: 'api',
            ...(isBatch ? { platformIds: source.platformIds ?? [] } : {}),
          },
        },
      },
      {
        id: `${source.siteKey}-snapshot`,
        name: '记录返回快照',
        action: {
          type: 'screenshot',
          selector: 'body',
          params: { mode: 'api' },
        },
      },
    ];
  }

  private buildTags(source: HotSourceDraft): string[] {
    const tags = new Set(source.tags ?? []);
    if (source.sourceKind === 'rss' || source.parserKey === 'rss.feed') {
      tags.add('hot:rss');
    }
    if (source.parserKey === 'newsnow.batch') {
      tags.add('hot:batch');
    }
    return Array.from(tags);
  }
}
