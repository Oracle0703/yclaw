import type { DataQualityBatchInsight, DataQualityScoreTrendHint } from '@shared/types';

export class InsightSummaryBuilder {
  build(input: {
    score: number;
    totalResults: number;
    issueCount: number;
    trend: DataQualityScoreTrendHint;
    topRuleId?: string;
  }): string {
    const trendText = this.toTrendText(input.trend);
    const ruleText = input.topRuleId ? `，主要命中规则为 ${input.topRuleId}` : '';

    return `质量分 ${input.score}，共扫描 ${input.totalResults} 条结果，发现 ${input.issueCount} 个问题，较上一批${trendText}${ruleText}。`;
  }

  private toTrendText(trend: DataQualityBatchInsight['scoreTrendHint']): string {
    switch (trend) {
      case 'up':
        return '上升';
      case 'down':
        return '下降';
      case 'flat':
        return '持平';
      default:
        return '暂无可比';
    }
  }
}
