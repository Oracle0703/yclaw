import type {
  DataQualityBatchInsight,
  DataQualityBatchScore,
  DataQualityFinding,
  ExtractionResult,
} from '@shared/types';

import { BatchComparator } from './BatchComparator';
import { InsightSummaryBuilder } from './InsightSummaryBuilder';

interface BuildInsightInput {
  batchId: string;
  taskId: string;
  results: ExtractionResult[];
  findings: DataQualityFinding[];
  batchScore: DataQualityBatchScore;
  previousBatchScore?: DataQualityBatchScore | null;
}

export class BatchInsightService {
  private readonly comparator: BatchComparator;
  private readonly summaryBuilder: InsightSummaryBuilder;

  constructor(options: { comparator?: BatchComparator; summaryBuilder?: InsightSummaryBuilder } = {}) {
    this.comparator = options.comparator ?? new BatchComparator();
    this.summaryBuilder = options.summaryBuilder ?? new InsightSummaryBuilder();
  }

  buildInsight(input: BuildInsightInput): DataQualityBatchInsight {
    const totalResults = input.results.length;
    const affectedResults = new Set(input.findings.map((finding) => finding.resultId)).size;
    const topRules = toSortedCounts(input.findings.map((finding) => finding.ruleId), 'ruleId');
    const topFields = toSortedCounts(
      input.findings
        .map((finding) => finding.fieldPath)
        .filter((fieldPath): fieldPath is string => Boolean(fieldPath)),
      'fieldPath',
    );
    const severityBreakdown = {
      error: input.findings.filter((finding) => finding.severity === 'error').length,
      warning: input.findings.filter((finding) => finding.severity === 'warning').length,
    };
    const statusBreakdown = input.results.reduce<Record<string, number>>((accumulator, result) => {
      accumulator[result.status] = (accumulator[result.status] ?? 0) + 1;
      return accumulator;
    }, {});
    const trend = this.comparator.compare(input.batchScore, input.previousBatchScore);

    return {
      id: `insight:${input.batchId}`,
      batchId: input.batchId,
      taskId: input.taskId,
      score: input.batchScore.score,
      grade: input.batchScore.grade,
      totalResults,
      issueCount: input.findings.length,
      affectedResults,
      failedRate: rateOf(input.results, (result) => result.status === 'failed'),
      suspiciousRate: rateOf(input.results, (result) => result.status === 'suspicious'),
      duplicateRate: totalResults === 0 ? 0 : countDistinctDuplicates(input.findings) / totalResults,
      topRules,
      topFields,
      severityBreakdown,
      statusBreakdown,
      scoreTrendHint: trend,
      summary: this.summaryBuilder.build({
        score: input.batchScore.score,
        totalResults,
        issueCount: input.findings.length,
        trend,
        topRuleId: topRules[0]?.ruleId,
      }),
      createdAt: new Date().toISOString(),
    };
  }
}

function rateOf(results: ExtractionResult[], predicate: (result: ExtractionResult) => boolean): number {
  if (results.length === 0) {
    return 0;
  }
  return results.filter(predicate).length / results.length;
}

function countDistinctDuplicates(findings: DataQualityFinding[]): number {
  return new Set(
    findings
      .filter((finding) => finding.ruleId === 'duplicate-payload')
      .map((finding) => finding.resultId),
  ).size;
}

function toSortedCounts<T extends string>(
  values: T[],
  key: 'ruleId' | 'fieldPath',
): Array<{ [K in typeof key]: T } & { count: number }> {
  const counts = values.reduce<Map<T, number>>((accumulator, value) => {
    accumulator.set(value, (accumulator.get(value) ?? 0) + 1);
    return accumulator;
  }, new Map<T, number>());

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .map(([value, count]) => ({
      [key]: value,
      count,
    })) as Array<{ [K in typeof key]: T } & { count: number }>;
}
