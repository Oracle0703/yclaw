import { describe, expect, it } from 'vitest';
import {
  buildDataCenterResultQuery,
  formatDataCenterResultQuerySummary,
  parseDataCenterRouteContext,
} from '@renderer/entries/data-center/routeContext';

describe('parseDataCenterRouteContext', () => {
  it('extracts hot-monitor batch route context', () => {
    expect(
      parseDataCenterRouteContext({
        source: 'hot-monitor',
        taskId: 'task-hot-1',
        batchId: 'batch-hot-1',
        ignored: true,
      }),
    ).toEqual({
      source: 'hot-monitor',
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
    });
  });

  it('returns null for empty or unsupported route state', () => {
    expect(parseDataCenterRouteContext(null)).toBeNull();
    expect(parseDataCenterRouteContext({ taskId: '', batchId: 1 })).toBeNull();
  });

  it('builds result queries from optional route context', () => {
    expect(
      buildDataCenterResultQuery(
        {
          source: 'hot-monitor',
          taskId: 'task-hot-1',
          batchId: 'batch-hot-1',
        },
        200,
      ),
    ).toEqual({
      page: 1,
      pageSize: 200,
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
    });
    expect(buildDataCenterResultQuery(null, 20)).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it('formats result query summaries for export and audit surfaces', () => {
    expect(
      formatDataCenterResultQuerySummary({
        page: 1,
        pageSize: 20,
        taskId: 'task-hot-1',
        batchId: 'batch-hot-1',
      }),
    ).toBe('Task：task-hot-1 / Batch：batch-hot-1 / 每页 20');
    expect(
      formatDataCenterResultQuerySummary({
        page: 1,
        pageSize: 50,
        status: ['failed', 'ignored'],
        keyword: 'AI',
        createdFrom: '2026-04-01T00:00:00.000Z',
        createdTo: '2026-04-30T23:59:59.999Z',
      }),
    ).toBe('全部结果 / 状态：failed、ignored / 关键词：AI / 时间：2026-04-01 至 2026-04-30 / 每页 50');
    expect(
      formatDataCenterResultQuerySummary({
        page: 1,
        pageSize: 10,
        createdFrom: '2026-04-01T00:00:00.000Z',
      }),
    ).toBe('全部结果 / 时间：2026-04-01 至 不限 / 每页 10');
  });
});
