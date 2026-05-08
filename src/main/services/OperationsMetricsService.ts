import type {
  AlertRecord,
  ExtractionResult,
  OperationsAcceptanceMetric,
  TaskBatch,
  TaskReviewRecord,
} from '@shared/types';

export interface OperationsAcceptanceSnapshot {
  batches: TaskBatch[];
  alerts: AlertRecord[];
  results: ExtractionResult[];
  reviews: TaskReviewRecord[];
}

export class OperationsMetricsService {
  buildAcceptanceMetrics(snapshot: OperationsAcceptanceSnapshot): OperationsAcceptanceMetric[] {
    return [
      buildMetric(
        'taskSuccessRate',
        '任务执行成功率',
        ratio(
          snapshot.batches.filter((batch) => batch.status === 'success').length,
          snapshot.batches.length,
        ),
        0.9,
      ),
      buildMetric(
        'alertClaimRate',
        '告警认领及时率',
        ratio(
          snapshot.alerts.filter((alert) =>
            ['claimed', 'processing', 'escalated', 'recovered', 'closed'].includes(alert.status ?? ''),
          ).length,
          snapshot.alerts.length,
        ),
        0.95,
      ),
      buildMetric(
        'resultTraceabilityRate',
        '结果追溯完整率',
        ratio(
          snapshot.results.filter((result) =>
            Boolean(result.revisionId)
              && Boolean(result.batchId)
              && (result.evidenceRefs?.length ?? 0) > 0,
          ).length,
          snapshot.results.length,
        ),
        0.95,
      ),
      buildMetric(
        'reviewBackflowRate',
        '复盘资产回流率',
        ratio(
          snapshot.reviews.filter((review) =>
            (review.linkedTemplateIds?.length ?? 0) > 0
              || review.followUpActions.some((action) =>
                ['update-template', 'link-template', 'template-governance'].includes(action),
              ),
          ).length,
          snapshot.reviews.length,
        ),
        0.8,
      ),
    ];
  }
}

function buildMetric(
  key: OperationsAcceptanceMetric['key'],
  label: string,
  value: number,
  target: number,
): OperationsAcceptanceMetric {
  return {
    key,
    label,
    value,
    target,
    unit: 'ratio',
    passed: value >= target,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 1;
  }

  return Number((numerator / denominator).toFixed(4));
}
