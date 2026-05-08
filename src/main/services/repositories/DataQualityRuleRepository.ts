import type { DataQualityRuleConfig } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface DataQualityRuleRow {
  rule_id: DataQualityRuleConfig['ruleId'];
  name: string;
  description: string;
  severity: DataQualityRuleConfig['severity'];
  enabled: number;
  params_json: string;
  rule_type: DataQualityRuleConfig['ruleType'] | null;
  scope: DataQualityRuleConfig['scope'] | null;
  field_path: string | null;
  operator: DataQualityRuleConfig['operator'] | null;
  expected_value_json: string | null;
  weight: number;
  group_json: string | null;
  created_at: string;
  updated_at: string;
}

export class DataQualityRuleRepository {
  constructor(private readonly executor: Executor) {}

  listRules(): DataQualityRuleConfig[] {
    return this.executor
      .all<DataQualityRuleRow>(
        `SELECT
           rule_id,
           name,
           description,
           severity,
           enabled,
           params_json,
           rule_type,
           scope,
           field_path,
           operator,
           expected_value_json,
           weight,
           group_json,
           created_at,
           updated_at
         FROM data_quality_rules
         ORDER BY rule_id ASC`,
      )
      .map(mapRuleRow);
  }

  saveRule(rule: DataQualityRuleConfig): void {
    this.executor.run(
      `INSERT OR REPLACE INTO data_quality_rules (
        rule_id,
        name,
        description,
        severity,
        enabled,
        params_json,
        rule_type,
        scope,
        field_path,
        operator,
        expected_value_json,
        weight,
        group_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.ruleId,
        rule.name,
        rule.description,
        rule.severity,
        rule.enabled ? 1 : 0,
        JSON.stringify(rule.params ?? {}),
        rule.ruleType ?? null,
        rule.scope ?? null,
        rule.fieldPath ?? null,
        rule.operator ?? null,
        rule.expectedValue === undefined ? null : JSON.stringify(rule.expectedValue),
        rule.weight ?? 1,
        rule.group === undefined ? null : JSON.stringify(rule.group),
        rule.createdAt,
        rule.updatedAt,
      ],
    );
  }
}

function mapRuleRow(row: DataQualityRuleRow): DataQualityRuleConfig {
  const rule: DataQualityRuleConfig = {
    ruleId: row.rule_id,
    name: row.name,
    description: row.description,
    severity: row.severity,
    enabled: row.enabled === 1,
    params: parseJson(row.params_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.rule_type) {
    rule.ruleType = row.rule_type;
  }
  if (row.scope) {
    rule.scope = row.scope;
  }
  if (row.field_path !== null) {
    rule.fieldPath = row.field_path;
  }
  if (row.operator !== null) {
    rule.operator = row.operator;
  }
  if (row.expected_value_json !== null) {
    rule.expectedValue = parseJson<unknown>(row.expected_value_json, null);
  }
  if (row.weight !== 1) {
    rule.weight = row.weight;
  }
  if (row.group_json !== null) {
    rule.group = parseJson(row.group_json, null);
  }

  return rule;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
