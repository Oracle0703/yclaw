import { describe, expect, it } from 'vitest';
import { parseBrowserInterventionRouteContext } from '@renderer/entries/browser/routeContext';

describe('parseBrowserInterventionRouteContext', () => {
  it('extracts hot monitor intervention route context', () => {
    expect(
      parseBrowserInterventionRouteContext({
        source: 'hot-monitor',
        taskId: 'task-hot-1',
        batchId: 'batch-hot-1',
        sourceId: 'source-hot-1',
        sourceName: 'AI 热榜',
        breakpoint: {
          stepIndex: 1,
          error: '页面结构变化',
          screenshot: 'shot.png',
          domSnapshot: 'dom.html',
        },
        ignored: true,
      }),
    ).toEqual({
      source: 'hot-monitor',
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
      sourceId: 'source-hot-1',
      sourceName: 'AI 热榜',
      breakpoint: {
        stepIndex: 1,
        error: '页面结构变化',
        screenshot: 'shot.png',
        domSnapshot: 'dom.html',
      },
    });
  });

  it('returns null for empty or unsupported route state', () => {
    expect(parseBrowserInterventionRouteContext(null)).toBeNull();
    expect(parseBrowserInterventionRouteContext({})).toBeNull();
    expect(parseBrowserInterventionRouteContext({ source: 'data-center' })).toBeNull();
    expect(
      parseBrowserInterventionRouteContext({
        source: 'hot-monitor',
        taskId: '',
        batchId: 'batch-hot-1',
        sourceId: 'source-hot-1',
      }),
    ).toBeNull();
  });

  it('drops invalid breakpoint while keeping valid route context', () => {
    expect(
      parseBrowserInterventionRouteContext({
        source: 'hot-monitor',
        taskId: 'task-hot-1',
        batchId: 'batch-hot-1',
        sourceId: 'source-hot-1',
        breakpoint: {
          stepIndex: '1',
          error: 403,
        },
      }),
    ).toEqual({
      source: 'hot-monitor',
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
      sourceId: 'source-hot-1',
      breakpoint: null,
    });
  });

  it('rejects non-integer or negative step indexes', () => {
    const base = {
      source: 'hot-monitor',
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
      sourceId: 'source-hot-1',
    };
    for (const stepIndex of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        parseBrowserInterventionRouteContext({
          ...base,
          breakpoint: { stepIndex, error: '错误' },
        })?.breakpoint,
      ).toBeNull();
    }
  });
});
