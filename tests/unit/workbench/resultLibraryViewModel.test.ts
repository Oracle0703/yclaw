import { describe, expect, it } from 'vitest';
import type { ExtractionResult, SigninRunSummary } from '@shared/types';
import { buildResultLibraryViewModel } from '@renderer/entries/workbench/task-toolbench/resultLibraryViewModel';

describe('result library view model', () => {
  it('combines standard extraction results with sign-in projections', () => {
    const standard: ExtractionResult = {
      id: 'result-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      data: { title: '商品列表', count: 3 },
      status: 'normal',
      createdAt: '2026-06-01T08:00:00.000Z',
    };
    const signin: SigninRunSummary = {
      taskId: 'task-jd',
      status: 'success',
      strategyUsed: 'api-fallback',
      reward: { detailText: '获得 10 京豆' },
      runAt: '2026-06-01T09:00:00.000Z',
      retryCount: 0,
    };

    const model = buildResultLibraryViewModel({
      standardResults: [standard],
      signinRuns: [signin],
    });

    expect(model.items).toEqual([
      expect.objectContaining({
        id: 'signin:task-jd:2026-06-01T09:00:00.000Z',
        sourceType: 'signin',
        batchId: null,
        statusLabel: '成功',
        summary: '获得 10 京豆',
        exportableFormats: ['json'],
        detailRef: { sourceType: 'signin', taskId: 'task-jd', runId: 'signin:task-jd:2026-06-01T09:00:00.000Z' },
      }),
      expect.objectContaining({
        id: 'result-1',
        sourceType: 'standard',
        batchId: 'batch-1',
        exportableFormats: ['json', 'jsonl', 'csv'],
        detailRef: { sourceType: 'standard', resultId: 'result-1' },
      }),
    ]);
  });

  it('maps failed and intervention sign-in runs to failed result display without batch ids', () => {
    const intervention: SigninRunSummary = {
      taskId: 'task-jd',
      status: 'needs_intervention',
      failureReason: 'session_expired',
      detail: '请重新登录',
      runAt: '2026-06-01T09:00:00.000Z',
      retryCount: 0,
    };

    const model = buildResultLibraryViewModel({
      standardResults: [],
      signinRuns: [intervention],
    });

    expect(model.items[0]).toMatchObject({
      sourceType: 'signin',
      batchId: null,
      status: 'failed',
      statusLabel: '需人工介入',
      summary: '请重新登录',
    });
  });

  it('projects hot reports as hot result items without calling them standard results', () => {
    const model = buildResultLibraryViewModel({
      standardResults: [],
      signinRuns: [],
      hotReports: [
        {
          id: 'report-1',
          sourceId: 'source-1',
          batchId: 'batch-1',
          title: '今日热点报告',
          format: 'html',
          filePath: '/tmp/report.html',
          createdAt: '2026-06-03T10:00:00.000Z',
        },
      ],
      hotSources: [
        {
          id: 'source-1',
          taskId: 'task-hot',
          name: '热点监控',
          sourceKind: 'api',
          siteKey: 'trendradar',
          entryUrl: 'https://newsnow.busiyi.world/',
          parserKey: 'newsnow.batch',
          enabled: true,
          tags: [],
          createdAt: '2026-06-03T09:00:00.000Z',
          updatedAt: '2026-06-03T09:00:00.000Z',
        },
      ],
    });

    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toMatchObject({
      id: 'hot-report:report-1',
      sourceType: 'hot',
      taskId: 'task-hot',
      batchId: 'batch-1',
      title: '今日热点报告',
      statusLabel: '已生成',
      detailRef: { sourceType: 'hot', reportId: 'report-1' },
      exportableFormats: [],
    });
  });
});
