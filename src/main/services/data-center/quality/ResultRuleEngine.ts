import type { DataQualityFinding, ExtractionResult } from '@shared/types';

import type { CompiledDataQualityRule } from './RuleCompiler';

const SCORE_IMPACT_BASE = {
  warning: 8,
  error: 20,
} as const;

export class ResultRuleEngine {
  evaluate(results: ExtractionResult[], rules: CompiledDataQualityRule[], scanId = 'scan-runtime'): DataQualityFinding[] {
    return results.flatMap((result) =>
      rules.flatMap((rule) => {
        const evaluation = rule.evaluate(result);
        if (!evaluation.matched) {
          return [];
        }

        return [
          {
            id: `${scanId}:${rule.ruleId}:${result.id}`,
            scanId,
            ruleId: rule.ruleId,
            severity: rule.severity,
            resultId: result.id,
            taskId: result.taskId,
            batchId: result.batchId,
            message: rule.description,
            fieldPath: evaluation.fieldPath ?? null,
            actualValue: evaluation.actualValue,
            expectedValue: evaluation.expectedValue,
            scoreImpact: Math.round(SCORE_IMPACT_BASE[rule.severity] * rule.weight),
            createdAt: result.createdAt,
          },
        ];
      }),
    );
  }
}
