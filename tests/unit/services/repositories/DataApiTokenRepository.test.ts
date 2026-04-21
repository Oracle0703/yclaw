import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';

import { DatabaseService } from '@main/services/DatabaseService';
import { DataApiTokenRepository } from '@main/services/repositories/DataApiTokenRepository';

describe('data-center migrations · api tokens', () => {
  it('creates api token table', () => {
    const database = new DatabaseService({ dbName: 'data-api-token-test.sqlite' });
    database.open();

    const tables = database
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).toContain('data_api_tokens');

    database.close();
  });

  it('saves and lists api tokens with parsed scopes', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataApiTokenRepository(databaseService);

    repository.saveToken({
      id: 'token-1',
      name: 'Notebook',
      tokenHash: 'hash',
      scopes: ['results:read', 'exports:read'],
      enabled: true,
      lastUsedAt: null,
      createdAt: '2026-04-21T00:00:00.000Z',
      revokedAt: null,
    });

    expect(repository.listTokens()).toEqual([
      expect.objectContaining({
        id: 'token-1',
        scopes: ['results:read', 'exports:read'],
        enabled: true,
      }),
    ]);

    databaseService.close();
  });

  it('verifies token hash and required scopes', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataApiTokenRepository(databaseService);

    repository.saveToken({
      id: 'token-1',
      name: 'Local API',
      tokenHash: createHash('sha256').update('secret-token').digest('hex'),
      scopes: ['results:read', 'exports:read'],
      enabled: true,
      lastUsedAt: null,
      createdAt: '2026-04-21T00:00:00.000Z',
      revokedAt: null,
    });

    expect(repository.verifyToken('secret-token', ['results:read'])).toBe(true);
    expect(repository.verifyToken('secret-token', ['tokens:write'])).toBe(false);
    expect(repository.verifyToken('wrong-token', ['results:read'])).toBe(false);

    databaseService.close();
  });

  it('checks all enabled tokens when verifying token hashes', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataApiTokenRepository(databaseService);

    repository.saveToken({
      id: 'token-1',
      name: 'Limited Token',
      tokenHash: createHash('sha256').update('shared-token').digest('hex'),
      scopes: ['datasets:read'],
      enabled: true,
      lastUsedAt: null,
      createdAt: '2026-04-21T00:00:00.000Z',
      revokedAt: null,
    });
    repository.saveToken({
      id: 'token-2',
      name: 'Scoped Token',
      tokenHash: createHash('sha256').update('shared-token').digest('hex'),
      scopes: ['results:read'],
      enabled: true,
      lastUsedAt: null,
      createdAt: '2026-04-21T00:01:00.000Z',
      revokedAt: null,
    });

    expect(repository.verifyToken('shared-token', ['results:read'])).toBe(true);

    databaseService.close();
  });
});
