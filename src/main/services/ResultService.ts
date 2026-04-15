import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { DatabaseService } from './DatabaseService';
import type { ExtractionResult } from '@shared/types';
import { DatabaseService as DatabaseServiceSingleton } from './DatabaseService';

export interface ResultQuery {
  taskId?: string;
  batchId?: string;
}

export interface ResultServiceOptions {
  databaseService?: Pick<DatabaseService, 'run' | 'get' | 'all'>;
}

export class ResultService {
  private readonly databaseService: Pick<DatabaseService, 'run' | 'get' | 'all'>;

  constructor(options: ResultServiceOptions = {}) {
    this.databaseService = options.databaseService ?? DatabaseServiceSingleton.getInstance();
  }

  saveResult(result: Omit<ExtractionResult, 'id'> & { id?: string }): ExtractionResult {
    const record: ExtractionResult = {
      id: result.id ?? randomUUID(),
      taskId: result.taskId,
      batchId: result.batchId,
      templateId: result.templateId ?? null,
      data: result.data,
      status: result.status,
      sourceUrl: result.sourceUrl,
      screenshot: result.screenshot,
      createdAt: result.createdAt,
    };

    this.databaseService.run(
      `INSERT INTO extraction_results (
        id, task_id, batch_id, template_id, data, status, source_url, screenshot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.taskId,
        record.batchId,
        record.templateId ?? null,
        JSON.stringify(record.data),
        record.status,
        record.sourceUrl ?? null,
        record.screenshot ?? null,
        record.createdAt,
      ],
    );

    return record;
  }

  listResults(query: ResultQuery = {}): ExtractionResult[] {
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
    const rows = this.databaseService.all<{
      id: string;
      task_id: string;
      batch_id: string;
      template_id?: string | null;
      data: string;
      status: ExtractionResult['status'];
      source_url?: string | null;
      screenshot?: string | null;
      created_at: string;
    }>(
      `SELECT id, task_id, batch_id, template_id, data, status, source_url, screenshot, created_at
       FROM extraction_results
       ${whereClause}
       ORDER BY created_at DESC`,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      batchId: row.batch_id,
      templateId: row.template_id ?? null,
      data: JSON.parse(row.data) as Record<string, unknown>,
      status: row.status,
      sourceUrl: row.source_url ?? undefined,
      screenshot: row.screenshot ?? undefined,
      createdAt: row.created_at,
    }));
  }

  getResult(resultId: string): ExtractionResult | null {
    const row = this.databaseService.get<{
      id: string;
      task_id: string;
      batch_id: string;
      template_id?: string | null;
      data: string;
      status: ExtractionResult['status'];
      source_url?: string | null;
      screenshot?: string | null;
      created_at: string;
    }>(
      `SELECT id, task_id, batch_id, template_id, data, status, source_url, screenshot, created_at
       FROM extraction_results
       WHERE id = ?`,
      [resultId],
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      taskId: row.task_id,
      batchId: row.batch_id,
      templateId: row.template_id ?? null,
      data: JSON.parse(row.data) as Record<string, unknown>,
      status: row.status,
      sourceUrl: row.source_url ?? undefined,
      screenshot: row.screenshot ?? undefined,
      createdAt: row.created_at,
    };
  }

  markSuspicious(resultId: string): void {
    this.databaseService.run('UPDATE extraction_results SET status = ? WHERE id = ?', [
      'suspicious',
      resultId,
    ]);
  }

  exportResults(query: ResultQuery, format: 'csv' | 'json'): string {
    const results = this.listResults(query);
    const outputPath = path.join(os.tmpdir(), `yclaw-results-${Date.now()}.${format}`);

    if (format === 'json') {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
      return outputPath;
    }

    const fieldNames = Array.from(new Set(results.flatMap((item) => Object.keys(item.data))));
    const escapeCsvCell = (value: unknown): string => {
      const str = value == null ? '' : String(value);
      // Strip leading formula characters to prevent CSV injection
      const sanitized = str.replace(/^[=+\-@\t\r]/, "'$&");
      // Always quote and escape internal double-quotes
      return `"${sanitized.replace(/"/g, '""')}"`;
    };
    const header = ['id', 'taskId', 'batchId', ...fieldNames].map(escapeCsvCell).join(',');
    const lines = results.map((item) =>
      [item.id, item.taskId, item.batchId, ...fieldNames.map((field) => item.data[field] ?? '')]
        .map(escapeCsvCell)
        .join(','),
    );
    fs.writeFileSync(outputPath, [header, ...lines].join('\n'), 'utf8');
    return outputPath;
  }
}
