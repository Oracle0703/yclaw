import type {
  DataQualityOperator,
  DataQualityRuleConfig,
  DataQualityRuleCondition,
} from '@shared/types';

export interface RuleEvaluationResult {
  matched: boolean;
  fieldPath?: string;
  actualValue?: unknown;
  expectedValue?: unknown;
}

export interface CompiledDataQualityRule {
  config: DataQualityRuleConfig;
  ruleId: DataQualityRuleConfig['ruleId'];
  name: string;
  description: string;
  severity: DataQualityRuleConfig['severity'];
  weight: number;
  evaluate: (value: unknown) => RuleEvaluationResult;
}

export class RuleCompiler {
  compile(rules: DataQualityRuleConfig[]): CompiledDataQualityRule[] {
    return rules
      .filter((rule) => rule.enabled)
      .map((rule) => ({
        config: rule,
        ruleId: rule.ruleId,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        weight: rule.weight ?? 1,
        evaluate: (value: unknown) => this.evaluateRule(rule, value),
      }));
  }

  private evaluateRule(rule: DataQualityRuleConfig, value: unknown): RuleEvaluationResult {
    if (rule.ruleType === 'group' && rule.group) {
      return this.evaluateGroup(rule.group.conditions, rule.group.mode, value);
    }

    const fieldPath = rule.fieldPath ?? undefined;
    const actualValue = fieldPath ? getByPath(value, fieldPath) : value;
    const operator = rule.operator ?? defaultOperatorFor(rule);
    const expectedValue = rule.expectedValue;
    const satisfiesRule = evaluateOperator(actualValue, operator, expectedValue);
    const matched = shouldMatchDirectly(rule.ruleType) ? satisfiesRule : !satisfiesRule;

    return {
      matched,
      fieldPath,
      actualValue,
      expectedValue,
    };
  }

  private evaluateGroup(
    conditions: DataQualityRuleCondition[],
    mode: 'all' | 'any',
    value: unknown,
  ): RuleEvaluationResult {
    const evaluations = conditions.map((condition) => {
      const actualValue = condition.fieldPath ? getByPath(value, condition.fieldPath) : value;

      return {
        matched: evaluateOperator(actualValue, condition.operator, condition.expectedValue),
        fieldPath: condition.fieldPath,
        actualValue,
        expectedValue: condition.expectedValue,
      };
    });
    const matched =
      mode === 'all'
        ? evaluations.every((evaluation) => evaluation.matched)
        : evaluations.some((evaluation) => evaluation.matched);
    const firstMatched = evaluations.find((evaluation) => evaluation.matched) ?? evaluations[0];

    return {
      matched,
      fieldPath: firstMatched?.fieldPath,
      actualValue: firstMatched?.actualValue,
      expectedValue: firstMatched?.expectedValue,
    };
  }
}

function defaultOperatorFor(rule: DataQualityRuleConfig): DataQualityOperator {
  if (rule.ruleType === 'status') {
    return 'eq';
  }
  if (rule.ruleType === 'field-empty') {
    return 'isEmpty';
  }
  if (rule.ruleType === 'field-exists') {
    return 'exists';
  }
  return 'eq';
}

function shouldMatchDirectly(ruleType?: DataQualityRuleConfig['ruleType']): boolean {
  return ruleType === 'field-empty' || ruleType === 'status';
}

export function evaluateOperator(
  actualValue: unknown,
  operator: DataQualityOperator,
  expectedValue?: unknown,
): boolean {
  switch (operator) {
    case 'exists':
      return actualValue !== undefined && actualValue !== null;
    case 'isEmpty':
      return (
        actualValue === undefined ||
        actualValue === null ||
        actualValue === '' ||
        (Array.isArray(actualValue) && actualValue.length === 0) ||
        (isRecord(actualValue) && Object.keys(actualValue).length === 0)
      );
    case 'eq':
      return actualValue === expectedValue;
    case 'ne':
      return actualValue !== expectedValue;
    case 'gt':
      return typeof actualValue === 'number' && typeof expectedValue === 'number'
        ? actualValue > expectedValue
        : Number(actualValue) > Number(expectedValue);
    case 'gte':
      return typeof actualValue === 'number' && typeof expectedValue === 'number'
        ? actualValue >= expectedValue
        : Number(actualValue) >= Number(expectedValue);
    case 'lt':
      return typeof actualValue === 'number' && typeof expectedValue === 'number'
        ? actualValue < expectedValue
        : Number(actualValue) < Number(expectedValue);
    case 'lte':
      return typeof actualValue === 'number' && typeof expectedValue === 'number'
        ? actualValue <= expectedValue
        : Number(actualValue) <= Number(expectedValue);
    case 'in':
      return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
    case 'contains':
      return typeof actualValue === 'string'
        ? actualValue.includes(String(expectedValue ?? ''))
        : Array.isArray(actualValue) && actualValue.includes(expectedValue);
    case 'regex':
      return new RegExp(String(expectedValue ?? '')).test(String(actualValue ?? ''));
    default:
      return false;
  }
}

export function getByPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[segment];
  }, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
