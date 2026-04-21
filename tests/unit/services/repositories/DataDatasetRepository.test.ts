import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import { DatabaseService } from '@main/services/DatabaseService';
import { DataDatasetRepository } from '@main/services/repositories/DataDatasetRepository';

describe('data-center migrations · datasets', () => {
  it('creates dataset table', () => {
    const database = new DatabaseService({ dbName: 'data-dataset-test.sqlite' });
    database.open();

    const tables = database
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).toContain('data_datasets');

    database.close();
  });

  it('saves and lists datasets with parsed query json', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataDatasetRepository(databaseService);

    repository.saveDataset({
      id: 'dataset-1',
      name: 'Price Results',
      description: 'daily price rows',
      query: { taskId: 'task-1', page: 1, pageSize: 50 },
      fieldMapping: [{ key: 'price', alias: '价格', masked: false }],
      defaultFormat: 'jsonl',
      apiEnabled: true,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:01.000Z',
    });

    expect(repository.listDatasets()).toEqual([
      {
        id: 'dataset-1',
        name: 'Price Results',
        description: 'daily price rows',
        query: { taskId: 'task-1', page: 1, pageSize: 50 },
        fieldMapping: [{ key: 'price', alias: '价格', masked: false }],
        defaultFormat: 'jsonl',
        apiEnabled: true,
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:01.000Z',
      },
    ]);

    databaseService.close();
  });
});
