import { describe, expect, it } from 'vitest';
import {
  HOT_REPORT_FORMATS,
  buildHotSourceDraft,
  validateHotTemplateValues,
} from '@renderer/entries/workbench/task-toolbench/hotTemplateAdapter';

describe('hotTemplateAdapter', () => {
  it('builds a HotSourceDraft from minimum template values', () => {
    const draft = buildHotSourceDraft({
      name: '今日热点',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/',
      parserKey: 'newsnow.batch',
      platformIds: ['weibo', 'douyin'],
      enabled: true,
    });

    expect(draft).toMatchObject({
      name: '今日热点',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/',
      parserKey: 'newsnow.batch',
      platformIds: ['weibo', 'douyin'],
      schedule: { type: 'manual' },
      enabled: true,
    });
  });

  it('reports missing runnable fields', () => {
    expect(
      validateHotTemplateValues({
        name: '',
        sourceKind: 'api',
        siteKey: '',
        entryUrl: '',
        parserKey: '',
      }),
    ).toEqual(['任务名称不能为空', '站点标识不能为空', '入口 URL 不能为空', '解析器不能为空']);
  });

  it('only exposes report formats supported by HotReportService', () => {
    expect(HOT_REPORT_FORMATS).toEqual(['md', 'html']);
  });
});
