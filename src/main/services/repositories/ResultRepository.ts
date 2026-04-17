import type { ExtractionResult } from '@shared/types';

interface ResultRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface ResultRow {
  id: string;
  task_id: string;
  batch_id: string;
  template_id?: string | null;
  data: string;
  status: ExtractionResult['status'];
  source_url?: string | null;
  screenshot?: string | null;
  created_at: string;
}

export class ResultRepository {
  constructor(private readonly executor: ResultRepositoryExecutor) {}

  saveResult(result: ExtractionResult): void {
    this.executor.run(
      `INSERT INTO extraction_results (
        id, task_id, batch_id, template_id, data, status, source_url, screenshot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        result.taskId,
        result.batchId,
        result.templateId ?? null,
        JSON.stringify(result.data),
        result.status,
        result.sourceUrl ?? null,
        result.screenshot ?? null,
        result.createdAt,
      ],
    );
  }

  listResults(query: { taskId?: string; batchId?: string } = {}): ExtractionResult[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.taskId) {
      conditions.push('task_id = ?');
      params.push(query.taskId);
    }
    if (query.batchId) {
      conditions.push('batch_id = ?');
      params.push(query.batchId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.executor
      .all<ResultRow>(
        `SELECT id, task_id, batch_id, template_id, data, status, source_url, screenshot, created_at
         FROM extraction_results
         ${whereClause}
         ORDER BY created_at DESC`,
        params,
      )
      .map(mapResultRow);
  }

  getResult(resultId: string): ExtractionResult | null {
    const row = this.executor.get<ResultRow>(
      `SELECT id, task_id, batch_id, template_id, data, status, source_url, screenshot, created_at
       FROM extraction_results
       WHERE id = ?`,
      [resultId],
    );

    return row ? mapResultRow(row) : null;
  }

  markSuspicious(resultId: string): void {
    this.executor.run('UPDATE extraction_results SET status = ? WHERE id = ?', [
      'suspicious',
      resultId,
    ]);
  }
}

function mapResultRow(row: ResultRow): ExtractionResult {
  return {
    id: row.id,
    taskId: row.task_id,
    batchId: row.batch_id,
    templateId: row.template_id ?? null,
    data: parseJson<Record<string, unknown>>(row.data, {}),
    status: row.status,
    sourceUrl: row.source_url ?? undefined,
    screenshot: row.screenshot ?? undefined,
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
