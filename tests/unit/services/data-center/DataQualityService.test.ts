import { describe, expect, it, vi } from 'vitest';

import { DataQualityService } from '@main/services/data-center/DataQualityService';

describe('DataQualityService', () => {
  it('scans extraction results for empty, failed, suspicious and duplicate payload issues', async () => {
    const service = new DataQualityService({
      resultService: {
        listResults: vi.fn(() => [
          {
            id: 'result-empty',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: {},
            status: 'normal',
            createdAt: '2026-04-22T00:00:00.000Z',
          },
          {
            id: 'result-failed',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { title: '失败' },
            status: 'failed',
            createdAt: '2026-04-22T00:01:00.000Z',
          },
          {
            id: 'result-suspicious',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { title: '可疑' },
            status: 'suspicious',
            createdAt: '2026-04-22T00:02:00.000Z',
          },
          {
            id: 'result-dup-1',
            taskId: 'task-2',
            batchId: 'batch-2',
            data: { price: 12, title: '重复' },
            status: 'normal',
            createdAt: '2026-04-22T00:03:00.000Z',
          },
          {
            id: 'result-dup-2',
            taskId: 'task-2',
            batchId: 'batch-2',
            data: { title: '重复', price: 12 },
            status: 'normal',
            createdAt: '2026-04-22T00:04:00.000Z',
          },
        ]),
      },
    });

    const scan = await service.scan();

    expect(scan.totalResults).toBe(5);
    expect(scan.issueCount).toBe(5);
    expect(scan.affectedResults).toBe(5);
    expect(scan.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'empty-data', hitCount: 1 }),
        expect.objectContaining({ ruleId: 'failed-result', hitCount: 1 }),
        expect.objectContaining({ ruleId: 'suspicious-status', hitCount: 1 }),
        expect.objectContaining({ ruleId: 'duplicate-payload', hitCount: 2 }),
      ]),
    );
    expect(scan.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'duplicate-payload', resultId: 'result-dup-1' }),
        expect.objectContaining({ ruleId: 'duplicate-payload', resultId: 'result-dup-2' }),
      ]),
    );
  });

  it('persists rule config and skips disabled rules during scan', async () => {
    const savedRules: unknown[] = [];
    const repository = {
      listRules: vi.fn(() => savedRules),
      saveRule: vi.fn((rule: unknown) => {
        savedRules.splice(0, savedRules.length, rule);
      }),
    };
    const service = new DataQualityService({
      resultService: {
        listResults: vi.fn(() => [
          {
            id: 'result-failed',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { title: '失败' },
            status: 'failed',
            createdAt: '2026-04-22T00:01:00.000Z',
          },
        ]),
      },
      ruleRepository: repository,
    });

    const savedRule = service.saveRuleConfig({ ruleId: 'failed-result', enabled: false });
    const scan = await service.scan();

    expect(savedRule.enabled).toBe(false);
    expect(repository.saveRule).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'failed-result', enabled: false }));
    expect(service.listRuleConfigs()).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: 'failed-result', enabled: false })]),
    );
    expect(scan.issueCount).toBe(0);
  });

  it('returns batch score and batch insight for a scanned batch', async () => {
    const service = new DataQualityService({
      resultService: {
        listResults: vi.fn(() => [
          {
            id: 'result-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { title: '失败' },
            status: 'failed',
            createdAt: '2026-04-22T00:01:00.000Z',
          },
          {
            id: 'result-2',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { title: '正常' },
            status: 'normal',
            createdAt: '2026-04-22T00:02:00.000Z',
          },
        ]),
      },
    });

    const scan = await service.scan({ query: { batchId: 'batch-1' } });

    expect(scan.batchScore).toEqual({
      batchId: 'batch-1',
      score: 90,
      grade: 'excellent',
    });
    expect(scan.scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resultId: 'result-1', score: 80 }),
        expect.objectContaining({ resultId: 'result-2', score: 100 }),
      ]),
    );
    expect(scan.batchInsight).toEqual(
      expect.objectContaining({
        batchId: 'batch-1',
        score: 90,
        topRules: [{ ruleId: 'failed-result', count: 1 }],
      }),
    );
  });
});
