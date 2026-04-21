import type { DataExportAudit, DataExportJob, DataExportJobStatus, DataPage } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
}

interface DataExportJobRow {
  id: string;
  name: string;
  dataset_id?: string | null;
  query_json: string;
  target_type: DataExportJob['targetType'];
  target_config_json: string;
  format: DataExportJob['format'];
  status: DataExportJobStatus;
  result_count: number;
  output_path?: string | null;
  error?: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

interface ListJobsQuery {
  page?: number;
  pageSize?: number;
  status?: DataExportJobStatus;
}

export class DataExportJobRepository {
  constructor(private readonly executor: Executor) {}

  createJob(job: DataExportJob): DataExportJob {
    this.executor.run(
      `INSERT INTO data_export_jobs (
        id, name, dataset_id, query_json, target_type, target_config_json, format,
        status, result_count, output_path, error, retry_count, created_at, updated_at,
        started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.name,
        job.datasetId ?? null,
        JSON.stringify(job.query),
        job.targetType,
        JSON.stringify(job.targetConfig),
        job.format,
        job.status,
        job.resultCount,
        job.outputPath ?? null,
        job.error ?? null,
        job.retryCount,
        job.createdAt,
        job.updatedAt,
        job.startedAt ?? null,
        job.finishedAt ?? null,
      ],
    );
    return job;
  }

  listJobs(query: ListJobsQuery = {}): DataPage<DataExportJob> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = this.executor.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM data_export_jobs ${whereClause}`,
      params,
    )?.total ?? 0;
    const rows = this.executor.all<DataExportJobRow>(
      `SELECT id, name, dataset_id, query_json, target_type, target_config_json, format,
              status, result_count, output_path, error, retry_count, created_at, updated_at,
              started_at, finished_at
       FROM data_export_jobs
       ${whereClause}
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    return {
      items: rows.map(mapExportJobRow),
      total,
      page,
      pageSize,
    };
  }

  listByResultId(_resultId: string): DataExportJob[] {
    return [];
  }

  markRunning(exportJobId: string, startedAt: string): DataExportJob | null {
    this.executor.run(
      `UPDATE data_export_jobs
       SET status = ?, started_at = ?, updated_at = ?, error = NULL
       WHERE id = ?`,
      ['running', startedAt, startedAt, exportJobId],
    );
    return this.getJob(exportJobId);
  }

  markRetrying(exportJobId: string, updatedAt: string): DataExportJob | null {
    this.executor.run(
      `UPDATE data_export_jobs
       SET status = ?, retry_count = retry_count + 1, updated_at = ?, error = NULL,
           output_path = NULL, started_at = NULL, finished_at = NULL
       WHERE id = ?`,
      ['retrying', updatedAt, exportJobId],
    );
    return this.getJob(exportJobId);
  }

  markSucceeded(
    exportJobId: string,
    output: { resultCount: number; outputPath: string; finishedAt: string },
  ): DataExportJob | null {
    this.executor.run(
      `UPDATE data_export_jobs
       SET status = ?, result_count = ?, output_path = ?, finished_at = ?, updated_at = ?, error = NULL
       WHERE id = ?`,
      ['succeeded', output.resultCount, output.outputPath, output.finishedAt, output.finishedAt, exportJobId],
    );
    return this.getJob(exportJobId);
  }

  markFailed(exportJobId: string, error: string, finishedAt: string): DataExportJob | null {
    this.executor.run(
      `UPDATE data_export_jobs
       SET status = ?, error = ?, finished_at = ?, updated_at = ?
       WHERE id = ?`,
      ['failed', error, finishedAt, finishedAt, exportJobId],
    );
    return this.getJob(exportJobId);
  }

  markCancelled(exportJobId: string, finishedAt: string): DataExportJob | null {
    this.executor.run(
      `UPDATE data_export_jobs
       SET status = ?, finished_at = ?, updated_at = ?
       WHERE id = ?`,
      ['cancelled', finishedAt, finishedAt, exportJobId],
    );
    return this.getJob(exportJobId);
  }

  getJob(exportJobId: string): DataExportJob | null {
    const row = this.executor.get<DataExportJobRow>(
      `SELECT id, name, dataset_id, query_json, target_type, target_config_json, format,
              status, result_count, output_path, error, retry_count, created_at, updated_at,
              started_at, finished_at
       FROM data_export_jobs
       WHERE id = ?`,
      [exportJobId],
    );

    return row ? mapExportJobRow(row) : null;
  }

  appendAudit(audit: DataExportAudit): void {
    this.executor.run(
      `INSERT INTO data_export_audits (
        id, export_job_id, attempt, status, target_type, request_summary,
        response_summary, error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        audit.id,
        audit.exportJobId,
        audit.attempt,
        audit.status,
        audit.targetType,
        audit.requestSummary ?? null,
        audit.responseSummary ?? null,
        audit.error ?? null,
        audit.createdAt,
      ],
    );
  }
}

function mapExportJobRow(row: DataExportJobRow): DataExportJob {
  return {
    id: row.id,
    name: row.name,
    datasetId: row.dataset_id ?? null,
    query: parseJson(row.query_json, { page: 1, pageSize: 50 }),
    targetType: row.target_type,
    targetConfig: parseJson(row.target_config_json, {}),
    format: row.format,
    status: row.status,
    resultCount: row.result_count,
    outputPath: row.output_path ?? null,
    error: row.error ?? null,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
