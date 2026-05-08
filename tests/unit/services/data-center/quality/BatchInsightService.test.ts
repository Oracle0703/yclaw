import { describe, expect, it } from 'vitest';

import { BatchInsightService } from '@main/services/data-center/quality/BatchInsightService';

describe('BatchInsightService', () => {
  it('summarizes score, rates and top rules for a batch', () => {
    const insight = new BatchInsightService().buildInsight({
      batchId: 'batch-1',
      taskId: 'task-1',
      results: [
        { id: 'r1', status: 'failed' },
        { id: 'r2', status: 'normal' },
      ] as never,
      findings: [
        { ruleId: 'failed-result', severity: 'error', fieldPath: 'status', resultId: 'r1' },
      ] as never,
      batchScore: { batchId: 'batch-1', score: 80, grade: 'good' },
      previousBatchScore: { batchId: 'batch-0', score: 92, grade: 'excellent' },
    });

    expect(insight).toMatchObject({
      batchId: 'batch-1',
      score: 80,
      failedRate: 0.5,
      scoreTrendHint: 'down',
    });
    expect(insight.topRules[0]).toEqual({ ruleId: 'failed-result', count: 1 });
    expect(insight.summary).toContain('下降');
  });
});
