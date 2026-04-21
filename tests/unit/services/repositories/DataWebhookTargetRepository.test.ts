import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import { DatabaseService } from '@main/services/DatabaseService';
import { DataWebhookTargetRepository } from '@main/services/repositories/DataWebhookTargetRepository';

describe('data-center migrations · webhook targets', () => {
  it('creates webhook target table', () => {
    const database = new DatabaseService({ dbName: 'data-webhook-target-test.sqlite' });
    database.open();

    const tables = database
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).toContain('data_webhook_targets');

    database.close();
  });

  it('saves and lists webhook targets with parsed headers', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataWebhookTargetRepository(databaseService);

    repository.saveTarget({
      id: 'webhook-1',
      name: 'Pipeline',
      url: 'https://example.com/hook',
      headers: { authorization: 'Bearer token' },
      secretHash: 'hash',
      enabled: true,
      timeoutMs: 5000,
      maxRetries: 2,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(repository.listTargets()).toEqual([
      expect.objectContaining({
        id: 'webhook-1',
        headers: { authorization: 'Bearer token' },
        enabled: true,
      }),
    ]);

    databaseService.close();
  });
});
