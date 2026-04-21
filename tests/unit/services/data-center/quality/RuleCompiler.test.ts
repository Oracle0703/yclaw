import { describe, expect, it } from 'vitest';

import { RuleCompiler } from '@main/services/data-center/quality/RuleCompiler';
import type { DataQualityRuleConfig } from '@shared/types';

const baseRule: DataQualityRuleConfig = {
  ruleId: 'price-range',
  name: '价格范围',
  description: '价格必须大于 0',
  severity: 'error',
  enabled: true,
  params: {},
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  ruleType: 'number-range',
  scope: 'result',
  fieldPath: 'data.price',
  operator: 'gt',
  expectedValue: 0,
  weight: 1,
};

describe('RuleCompiler', () => {
  it('compiles a number-range rule into an executable predicate', () => {
    const compiled = new RuleCompiler().compile([baseRule]);
    const [rule] = compiled;

    expect(rule.evaluate({ data: { price: -1 }, status: 'normal' })).toEqual({
      matched: true,
      fieldPath: 'data.price',
      actualValue: -1,
      expectedValue: 0,
    });
  });

  it('compiles an all group rule', () => {
    const [rule] = new RuleCompiler().compile([
      {
        ...baseRule,
        ruleId: 'bad-price-title',
        ruleType: 'group',
        group: {
          mode: 'all',
          conditions: [
            { fieldPath: 'data.price', operator: 'lt', expectedValue: 0 },
            { fieldPath: 'data.title', operator: 'isEmpty' },
          ],
        },
      },
    ]);

    expect(rule.evaluate({ data: { price: -1, title: '' }, status: 'normal' }).matched).toBe(true);
    expect(rule.evaluate({ data: { price: 1, title: '' }, status: 'normal' }).matched).toBe(false);
  });
});
