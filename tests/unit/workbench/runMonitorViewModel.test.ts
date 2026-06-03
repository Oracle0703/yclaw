import { describe, expect, it } from 'vitest';
import type { SigninRunSummary, TaskBatch } from '@shared/types';
import { buildRunMonitorViewModel } from '@renderer/entries/workbench/task-toolbench/runMonitorViewModel';

describe('run monitor view model', () => {
  it('projects standard batches and sign-in histories into stable run records', () => {
    const batch: TaskBatch = {
      id: 'batch-1',
      taskId: 'task-1',
      status: 'failed',
      error: '选择器失败',
      stepResults: [],
      createdAt: '2026-06-01T08:00:00.000Z',
      startedAt: '2026-06-01T08:01:00.000Z',
      finishedAt: '2026-06-01T08:02:00.000Z',
    };
    const signin: SigninRunSummary = {
      taskId: 'task-jd',
      status: 'needs_intervention',
      failureReason: 'session_expired',
      detail: '登录态失效',
      debug: { pageUrl: 'https://jd.com', pageTitle: 'JD' },
      runAt: '2026-06-01T09:00:00.000Z',
      retryCount: 0,
    };

    const model = buildRunMonitorViewModel({
      batches: [batch],
      signinRuns: [signin],
    });

    expect(model.runs).toEqual([
      expect.objectContaining({
        runId: 'signin:task-jd:2026-06-01T09:00:00.000Z',
        sourceType: 'signin',
        rawStatus: 'needs_intervention',
        statusLabel: '需人工介入',
        actions: ['intervention-retry', 'view-result'],
      }),
      expect.objectContaining({
        runId: 'batch:batch-1',
        sourceType: 'batch',
        rawStatus: 'failed',
        statusLabel: '失败',
        actions: ['retry-batch', 'view-result'],
      }),
    ]);
  });

  it('keeps duplicate sign-in runAt values unique by appending their index', () => {
    const first: SigninRunSummary = {
      taskId: 'task-jd',
      status: 'failed',
      runAt: '2026-06-01T09:00:00.000Z',
      retryCount: 0,
    };
    const second: SigninRunSummary = {
      taskId: 'task-jd',
      status: 'success',
      runAt: '2026-06-01T09:00:00.000Z',
      retryCount: 1,
    };

    const model = buildRunMonitorViewModel({
      batches: [],
      signinRuns: [first, second],
    });

    expect(model.runs.map((run) => run.runId)).toEqual([
      'signin:task-jd:2026-06-01T09:00:00.000Z:1',
      'signin:task-jd:2026-06-01T09:00:00.000Z:0',
    ]);
  });

  it('projects hot runs and keeps report status separate from batch status', () => {
    const model = buildRunMonitorViewModel({
      batches: [],
      signinRuns: [],
      hotRuns: [
        {
          batchId: 'batch-hot',
          sourceId: 'source-hot',
          sourceName: '热点监控',
          status: 'success',
          startedAt: '2026-06-03T10:00:00.000Z',
          finishedAt: '2026-06-03T10:01:00.000Z',
          resultCount: 12,
          reportStatus: 'generated',
        },
      ],
      hotSources: [
        {
          id: 'source-hot',
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

    expect(model.runs[0]).toMatchObject({
      runId: 'hot:source-hot:batch-hot',
      sourceType: 'hot',
      taskId: 'task-hot',
      rawStatus: 'success',
      statusLabel: '成功',
      reportStatus: 'generated',
      resultCount: 12,
    });
  });
});
