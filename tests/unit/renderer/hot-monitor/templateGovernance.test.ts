import { describe, expect, it } from 'vitest';
import type { TaskReviewRecord } from '@shared/types';
import {
  ensureTemplateGovernanceAction,
  hasTemplateGovernanceIntent,
  mergeLinkedTemplateIds,
} from '@renderer/entries/hot-monitor/templateGovernance';

function makeReview(overrides: Partial<TaskReviewRecord> = {}): TaskReviewRecord {
  return {
    id: 'review-1',
    taskId: 'task-1',
    batchId: 'batch-1',
    reviewType: 'failure',
    reasonCategory: 'selector_changed',
    conclusion: '价格字段选择器需要改为 .price-current',
    owner: '当前值班员',
    followUpActions: ['update-selector'],
    linkedTemplateIds: [],
    createdAt: '2026-05-19T02:00:00.000Z',
    ...overrides,
  };
}

describe('templateGovernance', () => {
  it('detects review actions that should flow back to templates', () => {
    expect(hasTemplateGovernanceIntent(makeReview())).toBe(true);
    expect(
      hasTemplateGovernanceIntent(
        makeReview({
          reasonCategory: 'login_required',
          conclusion: '刷新登录态后观察下一次运行',
          followUpActions: ['refresh-session', 'monitor-next-run'],
        }),
      ),
    ).toBe(false);
  });

  it('adds template-governance action for template-related failures', () => {
    expect(ensureTemplateGovernanceAction(['update-selector'])).toEqual([
      'update-selector',
      'template-governance',
    ]);
  });

  it('does not duplicate template-governance action', () => {
    expect(ensureTemplateGovernanceAction(['update-parser', 'template-governance'])).toEqual([
      'update-parser',
      'template-governance',
    ]);
  });

  it('merges linked template ids without mutating the source review', () => {
    const review = makeReview({ linkedTemplateIds: ['template-1'] });
    const merged = mergeLinkedTemplateIds(review, 'template-2');
    const duplicated = mergeLinkedTemplateIds(merged, 'template-2');

    expect(merged).toEqual({
      ...review,
      linkedTemplateIds: ['template-1', 'template-2'],
    });
    expect(duplicated.linkedTemplateIds).toEqual(['template-1', 'template-2']);
    expect(review.linkedTemplateIds).toEqual(['template-1']);
  });

  it('returns false when both follow up actions and conclusion are empty', () => {
    expect(
      hasTemplateGovernanceIntent(
        makeReview({
          reasonCategory: 'unknown',
          conclusion: '',
          followUpActions: [],
        }),
      ),
    ).toBe(false);
  });
});
