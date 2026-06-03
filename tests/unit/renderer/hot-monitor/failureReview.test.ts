import { describe, expect, it } from 'vitest';
import type { HotRunDetail } from '@shared/types';
import {
  buildFailureReviewDraft,
  summarizeFailureEvidence,
} from '@renderer/entries/hot-monitor/failureReview';

function makeDetail(overrides: Partial<HotRunDetail> = {}): HotRunDetail {
  return {
    batchId: 'batch-failed',
    sourceId: 'source-failed',
    sourceName: '失败任务',
    taskId: 'task-failed',
    status: 'failed',
    startedAt: '2026-05-19T01:00:00.000Z',
    finishedAt: '2026-05-19T01:01:00.000Z',
    resultCount: 0,
    reportStatus: 'pending',
    error: '未找到热点列表 selector timeout',
    breakpoint: {
      stepIndex: 1,
      error: '未找到热点列表',
    },
    stepResults: [
      {
        stepId: 'open',
        success: true,
        duration: 100,
      },
      {
        stepId: 'extract',
        success: false,
        error: 'selector timeout',
        duration: 3000,
      },
    ],
    linkedResultIds: [],
    ...overrides,
  };
}

describe('failureReview', () => {
  it('summarizes failure evidence from hot run detail', () => {
    expect(summarizeFailureEvidence(makeDetail())).toEqual({
      failedStepCount: 1,
      totalStepCount: 2,
      linkedResultCount: 0,
      breakpointLabel: '第 2 步',
      primaryError: '未找到热点列表',
    });
  });

  it('builds selector failure review draft', () => {
    expect(buildFailureReviewDraft(makeDetail())).toEqual({
      reasonCategory: 'selector_changed',
      conclusion: '热点采集失败：未找到热点列表。建议检查页面结构或选择器后重新运行。',
      owner: '当前值班员',
      followUpActions: ['update-selector', 'retry-source', 'template-governance'],
    });
  });

  it('detects login or permission failures', () => {
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: 'HTTP 403 login required',
          breakpoint: { stepIndex: 0, error: 'login required' },
        }),
      ).reasonCategory,
    ).toBe('login_required');
  });

  it('detects parser structure failures', () => {
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: 'JSON parse failed: field title missing',
          breakpoint: null,
        }),
      ),
    ).toMatchObject({
      reasonCategory: 'parser_changed',
      followUpActions: ['update-parser', 'add-quality-check', 'template-governance'],
    });
  });

  it('adds template governance action for quality failures', () => {
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: null,
          breakpoint: null,
          resultCount: 0,
          linkedResultIds: [],
          stepResults: [],
        }),
      ).followUpActions,
    ).toEqual(['add-quality-check', 'monitor-next-run', 'template-governance']);
  });

  it('treats top-level error as the primary signal over step result errors', () => {
    // 顶层 error 是 parser 信号，stepResults 里有 selector 噪声，应优先识别为 parser_changed
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: 'JSON parse failed: field title missing',
          breakpoint: null,
          stepResults: [
            { stepId: 'extract', success: false, error: 'selector timeout', duration: 100 },
          ],
        }),
      ).reasonCategory,
    ).toBe('parser_changed');
  });

  it('falls back to step result errors when primary signals are empty', () => {
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: null,
          breakpoint: null,
          stepResults: [
            { stepId: 'fetch', success: false, error: 'network timeout 429', duration: 100 },
          ],
          resultCount: 1,
          linkedResultIds: ['r-1'],
        }),
      ).reasonCategory,
    ).toBe('network_or_rate_limit');
  });

  it('returns unknown when no signals match and results exist', () => {
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: '',
          breakpoint: null,
          stepResults: [],
          resultCount: 5,
          linkedResultIds: ['r-1'],
        }),
      ).reasonCategory,
    ).toBe('unknown');
  });

  it('does not crash when stepResults or linkedResultIds are missing', () => {
    const detail = {
      ...makeDetail(),
      stepResults: undefined as unknown as ReturnType<typeof makeDetail>['stepResults'],
      linkedResultIds: undefined as unknown as ReturnType<typeof makeDetail>['linkedResultIds'],
    };
    expect(() => buildFailureReviewDraft(detail)).not.toThrow();
  });
});
