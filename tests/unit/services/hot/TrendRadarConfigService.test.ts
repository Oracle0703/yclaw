import { describe, expect, it, vi } from 'vitest';

import { TrendRadarConfigService } from '@main/services/hot/TrendRadarConfigService';

describe('TrendRadarConfigService', () => {
  it('parses platform ids, keyword groups, global filters and standalone display config', () => {
    const service = new TrendRadarConfigService({
      configDir: 'E:/allsite/TrendRadar/config',
      exists: vi.fn((filePath: string) =>
        filePath.endsWith('config.yaml') || filePath.endsWith('frequency_words.txt')),
      readFile: vi.fn((filePath: string) => {
        if (filePath.endsWith('config.yaml')) {
          return `
platforms:
  enabled: true
  sources:
    - id: "toutiao"
      name: "今日头条"
    - id: "baidu"
      name: "百度热搜"
report:
  display_mode: "keyword"
filter:
  method: "keyword"
display:
  standalone:
    platforms: ["zhihu", "wallstreetcn-hot"]
    max_items: 20
`;
        }

        return `
[GLOBAL_FILTER]
震惊

[WORD_GROUPS]
[AI 相关]
/AI|OpenAI/ => AI
!广告

[中国]
中国
国产

/微软/ => 微软
/谷歌/ => 谷歌
/苹果/ => 苹果
`;
      }),
    });

    expect(service.loadProfile()).toEqual({
      platformIds: ['toutiao', 'baidu'],
      platformNames: {
        toutiao: '今日头条',
        baidu: '百度热搜',
      },
      displayMode: 'keyword',
      filterMethod: 'keyword',
      standalone: {
        platformIds: ['zhihu', 'wallstreetcn-hot'],
        maxItems: 20,
      },
      filter: {
        excludeKeywords: ['震惊'],
        keywordGroups: [
          {
            name: 'AI 相关',
            include: ['/AI|OpenAI/'],
            exclude: ['广告'],
          },
          {
            name: '中国',
            include: ['中国', '国产'],
          },
          {
            name: '微软 / 谷歌 / 苹果',
            include: ['/微软/', '/谷歌/', '/苹果/'],
          },
        ],
      },
    });
  });

  it('returns null when required TrendRadar config files are missing', () => {
    const service = new TrendRadarConfigService({
      configDir: 'E:/allsite/TrendRadar/config',
      exists: vi.fn(() => false),
      readFile: vi.fn(),
    });

    expect(service.loadProfile()).toBeNull();
  });
});
