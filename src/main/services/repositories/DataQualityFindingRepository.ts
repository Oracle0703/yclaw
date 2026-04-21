import type { DataQualityFinding } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface DataQualityFindingRow {
  id: string;
  scan_id: string;
  rule_id: DataQualityFinding['ruleId'];
  severity: DataQualityFinding['severity'];
  result_id: string;
  task_id: string;
  batch_id: string;
  message: string;
  field_path: string | null;
  actual_value_json: string | null;
  expected_value_json: string | null;
  score_impact: number;
  fingerprint: string | null;
  created_at: string;
}

export class DataQualityFindingRepository {
  constructor(private readonly executor: Executor) {}

  saveFindings(scanId: string, findings: DataQualityFinding[]): void {
    for (const finding of findings) {
      this.executor.run(
        `INSERT OR REPLACE INTO data_quality_findings (
          id, scan_id, rule_id, severity, result_id, task_id, batch_id, message,
          field_path, actual_value_json, expected_value_json, score_impact, fingerprint, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finding.id,
          scanId,
          finding.ruleId,
          finding.severity,
          finding.resultId,
          finding.taskId,
          finding.batchId,
          finding.message,
          finding.fieldPath ?? null,
          finding.actualValue === undefined ? null : JSON.stringify(finding.actualValue),
          finding.expectedValue === undefined ? null : JSON.stringify(finding.expectedValue),
          finding.scoreImpact,
          finding.fingerprint ?? null,
          finding.createdAt,
        ],
      );
    }
  }

  listFindingsByBatch(batchId: string): DataQualityFinding[] {
    return this.executor
      .all<DataQualityFindingRow>(
        `SELECT
           id,
           scan_id,
           rule_id,
           severity,
           result_id,
           task_id,
           batch_id,
           message,
           field_path,
           actual_value_json,
           expected_value_json,
           score_impact,
           fingerprint,
           created_at
         FROM data_quality_findings
         WHERE batch_id = ?
         ORDER BY created_at DESC, id ASC`,
        [batchId],
      )
      .map(mapFindingRow);
  }

  clearFindingsByBatch(batchId: string): void {
    this.executor.run(`DELETE FROM data_quality_findings WHERE batch_id = ?`, [batchId]);
  }
}

function mapFindingRow(row: DataQualityFindingRow): DataQualityFinding {
  return {
    id: row.id,
    scanId: row.scan_id,
    ruleId: row.rule_id,
    severity: row.severity,
    resultId: row.result_id,
    taskId: row.task_id,
    batchId: row.batch_id,
    message: row.message,
    fieldPath: row.field_path ?? null,
    actualValue: row.actual_value_json === null ? undefined : parseJson(row.actual_value_json, null),
    expectedValue:
      row.expected_value_json === null ? undefined : parseJson(row.expected_value_json, null),
    scoreImpact: row.score_impact,
    fingerprint: row.fingerprint ?? null,
    createdAt: row.created_at,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
