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
+芯片
!广告
@5

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
            required: ['芯片'],
            exclude: ['广告'],
            maxItems: 5,
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

  it('writes config.yaml, frequency_words.txt and timeline.yaml into the config directory', () => {
    const written = new Map<string, string>();
    const service = new TrendRadarConfigService({
      configDir: 'E:/allsite/TrendRadar/config',
      exists: vi.fn(() => true),
      readFile: vi.fn(),
      mkdir: vi.fn(),
      writeFile: vi.fn((filePath: string, content: string) => {
        written.set(filePath, content);
      }),
    });

    const result = service.saveFiles({
      config: 'platforms:\n  enabled: true\n',
      frequency: '[WORD_GROUPS]\nAI\n',
      timeline: 'presets: {}\n',
    });

    expect(result.configDir).toBe('E:/allsite/TrendRadar/config');
    expect(result.files.map((filePath) => filePath.replace(/\\/g, '/'))).toEqual([
      'E:/allsite/TrendRadar/config/config.yaml',
      'E:/allsite/TrendRadar/config/frequency_words.txt',
      'E:/allsite/TrendRadar/config/timeline.yaml',
    ]);
    const normalizedWritten = new Map(
      [...written.entries()].map(([filePath, content]) => [filePath.replace(/\\/g, '/'), content]),
    );
    expect(normalizedWritten.get('E:/allsite/TrendRadar/config/config.yaml')).toContain('platforms:');
    expect(normalizedWritten.get('E:/allsite/TrendRadar/config/frequency_words.txt')).toContain('[WORD_GROUPS]');
    expect(normalizedWritten.get('E:/allsite/TrendRadar/config/timeline.yaml')).toContain('presets:');
  });
});
