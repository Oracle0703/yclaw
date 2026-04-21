import { describe, expect, it } from 'vitest';

import { ResultRuleEngine } from '@main/services/data-center/quality/ResultRuleEngine';
import { RuleCompiler } from '@main/services/data-center/quality/RuleCompiler';

describe('ResultRuleEngine', () => {
  it('returns findings for field rules', () => {
    const rules = new RuleCompiler().compile([
      {
        ruleId: 'missing-price',
        name: '缺少价格',
        description: '价格不能为空',
        severity: 'warning',
        enabled: true,
        params: {},
        ruleType: 'field-exists',
        scope: 'result',
        fieldPath: 'data.price',
        operator: 'exists',
        weight: 1,
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
    ]);

    const findings = new ResultRuleEngine().evaluate(
      [
        {
          id: 'r1',
          taskId: 't1',
          batchId: 'b1',
          data: {},
          status: 'normal',
          createdAt: '2026-04-22T00:00:00.000Z',
        },
      ],
      rules,
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'missing-price',
        resultId: 'r1',
        fieldPath: 'data.price',
        scoreImpact: 8,
      }),
    ]);
  });
});
