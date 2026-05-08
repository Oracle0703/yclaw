import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import { DatabaseService } from '@main/services/DatabaseService';
import { DataExportJobRepository } from '@main/services/repositories/DataExportJobRepository';

describe('data-center migrations · export jobs', () => {
  it('creates export job and audit tables', () => {
    const db = new Database(':memory:');
    const database = new DatabaseService({ database: db });
    database.migrate();

    const tables = database
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).toContain('data_export_jobs');
    expect(tables).toContain('data_export_audits');

    database.close();
  });

  it('creates, lists and completes export jobs', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataExportJobRepository(databaseService);

    repository.createJob({
      id: 'export-1',
      name: 'Daily JSONL',
      datasetId: null,
      query: { taskId: 'task-1', page: 1, pageSize: 100 },
      targetType: 'file',
      targetConfig: { directory: '/tmp' },
      format: 'jsonl',
      status: 'pending',
      resultCount: 0,
      outputPath: null,
      error: null,
      retryCount: 0,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
      startedAt: null,
      finishedAt: null,
    });

    repository.markSucceeded('export-1', {
      resultCount: 2,
      outputPath: '/tmp/export-1.jsonl',
      finishedAt: '2026-04-21T00:00:03.000Z',
    });

    expect(repository.listJobs({ page: 1, pageSize: 10 }).items).toEqual([
      expect.objectContaining({
        id: 'export-1',
        status: 'succeeded',
        resultCount: 2,
        outputPath: '/tmp/export-1.jsonl',
      }),
    ]);

    databaseService.close();
  });
});
