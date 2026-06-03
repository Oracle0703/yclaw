import type {
  DataQualityGrade,
  DataQualityRuleId,
  DataQualityScanInput,
  DataQualityScanResult,
} from '@shared/types';

export interface VerificationQualitySummary {
  scoreLabel: string;
  gradeLabel: string;
  issueCount: number;
  affectedResults: number;
  totalResults: number;
  topRules: Array<{
    ruleId: DataQualityRuleId;
    count: number;
  }>;
  summary: string;
}

export function buildVerificationQualityScanInput(
  taskId: string,
  batchId: string,
): DataQualityScanInput {
  return {
    query: {
      taskId,
      batchId,
    },
    limit: 200,
  };
}

export function formatQualityGrade(grade?: DataQualityGrade | null): string {
  if (grade === 'excellent') {
    return '优秀';
  }
  if (grade === 'good') {
    return '良好';
  }
  if (grade === 'watch') {
    return '关注';
  }
  if (grade === 'poor') {
    return '较差';
  }
  return '-';
}

export function summarizeVerificationQuality(
  scan: DataQualityScanResult,
): VerificationQualitySummary {
  const insightTopRules = scan.batchInsight?.topRules ?? [];
  const fallbackTopRules = (scan.rules ?? []).map((rule) => ({
    ruleId: rule.ruleId,
    count: rule.hitCount,
  }));

  return {
    scoreLabel: typeof scan.batchScore?.score === 'number' ? String(scan.batchScore.score) : '-',
    gradeLabel: formatQualityGrade(scan.batchScore?.grade),
    issueCount: scan.issueCount ?? 0,
    affectedResults: scan.affectedResults ?? 0,
    totalResults: scan.totalResults ?? 0,
    topRules: (insightTopRules.length > 0 ? insightTopRules : fallbackTopRules).slice(0, 3),
    summary: scan.batchInsight?.summary ?? '暂无批次洞察摘要。',
  };
}
