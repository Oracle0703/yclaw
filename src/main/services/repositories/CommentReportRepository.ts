import type { CommentReportSummary } from '@shared/types';

interface CommentReportRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface CommentReportRow {
  id: string;
  source_id: string;
  batch_id: string;
  title: string;
  format: CommentReportSummary['format'];
  file_path: string;
  created_at: string;
}

export class CommentReportRepository {
  constructor(private readonly executor: CommentReportRepositoryExecutor) {}

  saveReport(report: CommentReportSummary): void {
    this.executor.run(
      `INSERT INTO comment_reports (
        id,
        source_id,
        batch_id,
        title,
        format,
        file_path,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_id = excluded.source_id,
        batch_id = excluded.batch_id,
        title = excluded.title,
        format = excluded.format,
        file_path = excluded.file_path`,
      [
        report.id,
        report.sourceId,
        report.batchId,
        report.title,
        report.format,
        report.filePath,
        report.createdAt,
      ],
    );
  }

  listReports(query: { sourceId?: string; batchId?: string } = {}): CommentReportSummary[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (query.sourceId) {
      clauses.push('source_id = ?');
      params.push(query.sourceId);
    }
    if (query.batchId) {
      clauses.push('batch_id = ?');
      params.push(query.batchId);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.executor
      .all<CommentReportRow>(
        `SELECT id, source_id, batch_id, title, format, file_path, created_at
         FROM comment_reports
         ${whereClause}
         ORDER BY created_at DESC`,
        params,
      )
      .map(mapCommentReportRow);
  }

  getReport(reportId: string): CommentReportSummary | null {
    const row = this.executor.get<CommentReportRow>(
      `SELECT id, source_id, batch_id, title, format, file_path, created_at
       FROM comment_reports
       WHERE id = ?`,
      [reportId],
    );
    return row ? mapCommentReportRow(row) : null;
  }

  getReportByBatchId(batchId: string): CommentReportSummary | null {
    const row = this.executor.get<CommentReportRow>(
      `SELECT id, source_id, batch_id, title, format, file_path, created_at
       FROM comment_reports
       WHERE batch_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId],
    );
    return row ? mapCommentReportRow(row) : null;
  }

  deleteReport(reportId: string): boolean {
    const result = this.executor.run('DELETE FROM comment_reports WHERE id = ?', [reportId]);
    return (result.changes ?? 0) > 0;
  }
}

function mapCommentReportRow(row: CommentReportRow): CommentReportSummary {
  return {
    id: row.id,
    sourceId: row.source_id,
    batchId: row.batch_id,
    title: row.title,
    format: row.format,
    filePath: row.file_path,
    createdAt: row.created_at,
  };
}
