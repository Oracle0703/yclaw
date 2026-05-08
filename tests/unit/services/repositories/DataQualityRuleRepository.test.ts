import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import { DatabaseService } from '@main/services/DatabaseService';
import { DataQualityRuleRepository } from '@main/services/repositories/DataQualityRuleRepository';

describe('data-center migrations · quality rules', () => {
  it('creates quality rule table', () => {
    const db = new Database(':memory:');
    const database = new DatabaseService({ database: db });
    database.migrate();

    const tables = database
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).toContain('data_quality_rules');

    database.close();
  });

  it('saves and lists quality rule configs', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataQualityRuleRepository(databaseService);

    repository.saveRule({
      ruleId: 'failed-result',
      name: '失败结果',
      description: '失败结果不参与出口',
      severity: 'error',
      enabled: false,
      params: { notify: true },
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:01.000Z',
    });

    expect(repository.listRules()).toEqual([
      {
        ruleId: 'failed-result',
        name: '失败结果',
        description: '失败结果不参与出口',
        severity: 'error',
        enabled: false,
        params: { notify: true },
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:01.000Z',
      },
    ]);

    databaseService.close();
  });

  it('saves advanced rule fields', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataQualityRuleRepository(databaseService);

    repository.saveRule({
      ruleId: 'price-range',
      name: '价格范围',
      description: '价格必须大于 0',
      severity: 'error',
      enabled: true,
      params: {},
      ruleType: 'number-range',
      scope: 'result',
      fieldPath: 'data.price',
      operator: 'gt',
      expectedValue: 0,
      weight: 1.5,
      group: null,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:01.000Z',
    });

    expect(repository.listRules()[0]).toMatchObject({
      ruleId: 'price-range',
      ruleType: 'number-range',
      fieldPath: 'data.price',
      operator: 'gt',
      expectedValue: 0,
      weight: 1.5,
    });

    databaseService.close();
  });
});
