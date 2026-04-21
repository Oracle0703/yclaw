import { describe, expect, it } from 'vitest';

import { ScoreCalculator } from '@main/services/data-center/quality/ScoreCalculator';

describe('ScoreCalculator', () => {
  it('calculates explainable result score from findings', () => {
    const score = new ScoreCalculator().calculateResultScore('r1', [
      { id: 'f1', ruleId: 'failed-result', resultId: 'r1', severity: 'error', scoreImpact: 20 },
      { id: 'f2', ruleId: 'missing-price', resultId: 'r1', severity: 'warning', scoreImpact: 8 },
    ] as never);

    expect(score).toEqual({
      resultId: 'r1',
      score: 72,
      grade: 'watch',
      deductions: [
        { ruleId: 'failed-result', points: 20 },
        { ruleId: 'missing-price', points: 8 },
      ],
    });
  });

  it('calculates batch score as average result score', () => {
    const score = new ScoreCalculator().calculateBatchScore('batch-1', [
      { resultId: 'r1', score: 100, grade: 'excellent', deductions: [] },
      { resultId: 'r2', score: 60, grade: 'watch', deductions: [] },
    ]);

    expect(score).toEqual({ batchId: 'batch-1', score: 80, grade: 'good' });
  });
});
