import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import { DatabaseService } from '@main/services/DatabaseService';
import { DataQualityFindingRepository } from '@main/services/repositories/DataQualityFindingRepository';

describe('DataQualityFindingRepository', () => {
  it('saves and lists findings by batch', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataQualityFindingRepository(databaseService);

    repository.saveFindings('scan-1', [
      {
        id: 'finding-1',
        scanId: 'scan-1',
        ruleId: 'failed-result',
        severity: 'error',
        resultId: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        message: '结果状态为失败',
        fieldPath: 'status',
        actualValue: 'failed',
        expectedValue: 'normal',
        scoreImpact: 20,
        createdAt: '2026-04-22T00:00:00.000Z',
      },
    ]);

    expect(repository.listFindingsByBatch('batch-1')).toEqual([
      expect.objectContaining({ id: 'finding-1', scoreImpact: 20 }),
    ]);

    repository.clearFindingsByBatch('batch-1');
    expect(repository.listFindingsByBatch('batch-1')).toEqual([]);
  });
});
