import type { HotSourceDraft } from '@shared/types';

const NEWSNOW_API_BASE = 'https://newsnow.busiyi.world/api/s';

export interface NewsNowPreset {
  id: string;
  name: string;
  tags: string[];
}

export const NEWSNOW_PRESETS: NewsNowPreset[] = [
  { id: 'zhihu', name: '知乎热榜', tags: ['社区', '热榜'] },
  { id: 'weibo', name: '微博热搜', tags: ['社媒', '热榜'] },
  { id: 'wallstreetcn-hot', name: '华尔街见闻', tags: ['财经', '热榜'] },
  { id: 'douyin', name: '抖音热点', tags: ['短视频', '热榜'] },
];

export const TRENDRADAR_PLATFORM_IDS = [
  'toutiao',
  'baidu',
  'wallstreetcn-hot',
  'thepaper',
  'bilibili-hot-search',
  'cls-hot',
  'ifeng',
  'tieba',
  'weibo',
  'douyin',
  'zhihu',
];

export function createNewsNowDraft(preset: NewsNowPreset): HotSourceDraft {
  return {
    name: preset.name,
    sourceKind: 'api',
    siteKey: preset.id,
    entryUrl: `${NEWSNOW_API_BASE}?id=${preset.id}&latest`,
    parserKey: 'newsnow.hot',
    enabled: true,
    tags: preset.tags,
  };
}

export function createTrendRadarBatchDraft(): HotSourceDraft {
  return {
    name: 'TrendRadar 多平台热榜',
    sourceKind: 'api',
    siteKey: 'trendradar',
    entryUrl: NEWSNOW_API_BASE,
    parserKey: 'newsnow.batch',
    platformIds: TRENDRADAR_PLATFORM_IDS,
    enabled: true,
    tags: ['TrendRadar', '多平台', '热榜'],
  };
}
