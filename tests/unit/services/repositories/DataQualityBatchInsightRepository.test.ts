import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import { DatabaseService } from '@main/services/DatabaseService';
import { DataQualityBatchInsightRepository } from '@main/services/repositories/DataQualityBatchInsightRepository';

describe('DataQualityBatchInsightRepository', () => {
  it('saves and gets batch insight', () => {
    const db = new Database(':memory:');
    const databaseService = new DatabaseService({ database: db });
    databaseService.migrate();
    const repository = new DataQualityBatchInsightRepository(databaseService);

    repository.saveInsight({
      id: 'insight-1',
      batchId: 'batch-1',
      taskId: 'task-1',
      score: 80,
      grade: 'good',
      totalResults: 2,
      issueCount: 1,
      affectedResults: 1,
      failedRate: 0.5,
      suspiciousRate: 0,
      duplicateRate: 0,
      topRules: [{ ruleId: 'failed-result', count: 1 }],
      topFields: [{ fieldPath: 'status', count: 1 }],
      severityBreakdown: { error: 1, warning: 0 },
      statusBreakdown: { failed: 1, normal: 1 },
      scoreTrendHint: 'down',
      summary: '质量分 80，较上一批下降。',
      createdAt: '2026-04-22T00:00:00.000Z',
    });

    expect(repository.getInsight('batch-1')).toEqual(
      expect.objectContaining({ batchId: 'batch-1', score: 80, scoreTrendHint: 'down' }),
    );
    expect(repository.listInsightsByTask('task-1')).toHaveLength(1);
  });
});
