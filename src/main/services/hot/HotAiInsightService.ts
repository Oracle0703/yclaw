import type { ExtractionResult } from '@shared/types';

interface HotAiClient {
  summarize(input: { prompt: string; results: ExtractionResult[] }): Promise<string>;
}

export class HotAiInsightService {
  constructor(private readonly options: { aiClient?: HotAiClient } = {}) {}

  async summarize(input: {
    interest: string;
    results: ExtractionResult[];
  }): Promise<{ prompt: string; summary: string; matchedResultIds: string[] }> {
    const prompt = [
      `兴趣描述：${input.interest}`,
      '热点条目：',
      ...input.results.map((result, index) => `${index + 1}. ${result.data.title ?? ''} ${result.data.url ?? ''}`),
      '请给出重点摘要、原因和后续关注点。',
    ].join('\n');
    const summary = this.options.aiClient
      ? await this.options.aiClient.summarize({ prompt, results: input.results })
      : buildFallbackSummary(input.results);

    return {
      prompt,
      summary,
      matchedResultIds: input.results.map((result) => result.id),
    };
  }
}

function buildFallbackSummary(results: ExtractionResult[]): string {
  if (results.length === 0) {
    return '暂无匹配热点。';
  }
  return results
    .slice(0, 5)
    .map((result, index) => `${index + 1}. ${String(result.data.title ?? '未命名热点')}`)
    .join('\n');
}
