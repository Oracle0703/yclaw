import type { DataQualityBatchInsight } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
}

interface DataQualityBatchInsightRow {
  id: string;
  batch_id: string;
  task_id: string;
  score: number;
  grade: DataQualityBatchInsight['grade'];
  total_results: number;
  issue_count: number;
  affected_results: number;
  failed_rate: number;
  suspicious_rate: number;
  duplicate_rate: number;
  top_rules_json: string;
  top_fields_json: string;
  severity_breakdown_json: string;
  status_breakdown_json: string;
  score_trend_hint: DataQualityBatchInsight['scoreTrendHint'];
  summary: string;
  created_at: string;
}

export class DataQualityBatchInsightRepository {
  constructor(private readonly executor: Executor) {}

  saveInsight(insight: DataQualityBatchInsight): void {
    this.executor.run(
      `INSERT OR REPLACE INTO data_quality_batch_insights (
        id, batch_id, task_id, score, grade, total_results, issue_count, affected_results,
        failed_rate, suspicious_rate, duplicate_rate, top_rules_json, top_fields_json,
        severity_breakdown_json, status_breakdown_json, score_trend_hint, summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insight.id,
        insight.batchId,
        insight.taskId,
        insight.score,
        insight.grade,
        insight.totalResults,
        insight.issueCount,
        insight.affectedResults,
        insight.failedRate,
        insight.suspiciousRate,
        insight.duplicateRate,
        JSON.stringify(insight.topRules),
        JSON.stringify(insight.topFields),
        JSON.stringify(insight.severityBreakdown),
        JSON.stringify(insight.statusBreakdown),
        insight.scoreTrendHint,
        insight.summary,
        insight.createdAt,
      ],
    );
  }

  getInsight(batchId: string): DataQualityBatchInsight | null {
    const row = this.executor.get<DataQualityBatchInsightRow>(
      `SELECT
         id,
         batch_id,
         task_id,
         score,
         grade,
         total_results,
         issue_count,
         affected_results,
         failed_rate,
         suspicious_rate,
         duplicate_rate,
         top_rules_json,
         top_fields_json,
         severity_breakdown_json,
         status_breakdown_json,
         score_trend_hint,
         summary,
         created_at
       FROM data_quality_batch_insights
       WHERE batch_id = ?`,
      [batchId],
    );

    return row ? mapInsightRow(row) : null;
  }

  listInsightsByTask(taskId: string): DataQualityBatchInsight[] {
    return this.executor
      .all<DataQualityBatchInsightRow>(
        `SELECT
           id,
           batch_id,
           task_id,
           score,
           grade,
           total_results,
           issue_count,
           affected_results,
           failed_rate,
           suspicious_rate,
           duplicate_rate,
           top_rules_json,
           top_fields_json,
           severity_breakdown_json,
           status_breakdown_json,
           score_trend_hint,
           summary,
           created_at
         FROM data_quality_batch_insights
         WHERE task_id = ?
         ORDER BY created_at DESC, batch_id DESC`,
        [taskId],
      )
      .map(mapInsightRow);
  }
}

function mapInsightRow(row: DataQualityBatchInsightRow): DataQualityBatchInsight {
  return {
    id: row.id,
    batchId: row.batch_id,
    taskId: row.task_id,
    score: row.score,
    grade: row.grade,
    totalResults: row.total_results,
    issueCount: row.issue_count,
    affectedResults: row.affected_results,
    failedRate: row.failed_rate,
    suspiciousRate: row.suspicious_rate,
    duplicateRate: row.duplicate_rate,
    topRules: parseJson(row.top_rules_json, []),
    topFields: parseJson(row.top_fields_json, []),
    severityBreakdown: parseJson(row.severity_breakdown_json, { error: 0, warning: 0 }),
    statusBreakdown: parseJson(row.status_breakdown_json, {}),
    scoreTrendHint: row.score_trend_hint,
    summary: row.summary,
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
