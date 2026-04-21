import { describe, expect, it } from 'vitest';
import { OperationsMetricsService } from '@main/services/OperationsMetricsService';

describe('OperationsMetricsService', () => {
  it('builds unified acceptance metrics from operations records', () => {
    const service = new OperationsMetricsService();

    const metrics = service.buildAcceptanceMetrics({
      batches: [
        { id: 'batch-1', taskId: 'task-1', status: 'success', stepResults: [], createdAt: '2026-04-21T00:00:00.000Z' },
        { id: 'batch-2', taskId: 'task-1', status: 'failed', stepResults: [], createdAt: '2026-04-21T00:01:00.000Z' },
      ],
      alerts: [
        { id: 'alert-1', taskId: 'task-1', message: '失败', createdAt: '2026-04-21T00:00:00.000Z', read: false, status: 'claimed' },
        { id: 'alert-2', taskId: 'task-2', message: '失败', createdAt: '2026-04-21T00:00:00.000Z', read: false, status: 'new' },
      ],
      results: [
        {
          id: 'result-1',
          taskId: 'task-1',
          batchId: 'batch-1',
          data: {},
          status: 'normal',
          evidenceRefs: [{ kind: 'screenshot', refId: 'shot-1' }],
          revisionId: 'revision-1',
          createdAt: '2026-04-21T00:00:00.000Z',
        },
        {
          id: 'result-2',
          taskId: 'task-1',
          batchId: 'batch-2',
          data: {},
          status: 'failed',
          createdAt: '2026-04-21T00:01:00.000Z',
        },
      ],
      reviews: [
        {
          id: 'review-1',
          taskId: 'task-1',
          reviewType: 'failure',
          followUpActions: ['update-template'],
          linkedTemplateIds: ['template-1'],
          createdAt: '2026-04-21T00:00:00.000Z',
        },
        {
          id: 'review-2',
          taskId: 'task-2',
          reviewType: 'quality',
          followUpActions: [],
          createdAt: '2026-04-21T00:01:00.000Z',
        },
      ],
    });

    expect(metrics).toContainEqual({
      key: 'taskSuccessRate',
      label: '任务执行成功率',
      value: 0.5,
      target: 0.9,
      unit: 'ratio',
      passed: false,
    });
    expect(metrics).toContainEqual({
      key: 'alertClaimRate',
      label: '告警认领及时率',
      value: 0.5,
      target: 0.95,
      unit: 'ratio',
      passed: false,
    });
    expect(metrics).toContainEqual({
      key: 'resultTraceabilityRate',
      label: '结果追溯完整率',
      value: 0.5,
      target: 0.95,
      unit: 'ratio',
      passed: false,
    });
    expect(metrics).toContainEqual({
      key: 'reviewBackflowRate',
      label: '复盘资产回流率',
      value: 0.5,
      target: 0.8,
      unit: 'ratio',
      passed: false,
    });
  });
});
