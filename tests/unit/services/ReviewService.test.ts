import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewService } from '@main/services/ReviewService';

const mockReviewRepository = {
  createReview: vi.fn(),
  listReviews: vi.fn(),
  getReview: vi.fn(),
};

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewService({
      reviewRepository: mockReviewRepository,
    });
  });

  it('requires review repository injection', () => {
    expect(() => new ReviewService()).toThrow('reviewRepository is required');
  });

  it('stores review and links follow-up template action', () => {
    mockReviewRepository.createReview.mockImplementationOnce((review) => review);

    const review = service.createReview({
      taskId: 'task-1',
      batchId: 'batch-1',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '更新模板选择器',
      owner: 'alice',
      followUpActions: ['update-template'],
    });

    expect(review.reviewType).toBe('failure');
    expect(review.followUpActions).toContain('update-template');
  });

  it('suggests template backflow when review contains template follow-up action', () => {
    mockReviewRepository.getReview.mockReturnValueOnce({
      id: 'review-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '更新模板选择器',
      owner: 'alice',
      followUpActions: ['update-template'],
      createdAt: '2026-04-21T00:00:00.000Z',
    });

    const suggestion = service.suggestTemplateBackflow('review-1', 'template-1');

    expect(suggestion).toMatchObject({
      reviewId: 'review-1',
      templateId: 'template-1',
      recommended: true,
    });
    expect(suggestion.reason).toContain('update-template');
  });

  it('creates executable template backflow draft from review conclusion', () => {
    mockReviewRepository.getReview.mockReturnValueOnce({
      id: 'review-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '价格字段选择器需要改为 .price-current',
      owner: 'alice',
      followUpActions: ['update-template', 'add-quality-check'],
      createdAt: '2026-04-21T00:00:00.000Z',
    });

    const draft = service.createTemplateBackflowDraft('review-1', 'template-1');

    expect(draft).toMatchObject({
      reviewId: 'review-1',
      templateId: 'template-1',
      title: '回流复盘结论到模板',
      status: 'draft',
      riskLevel: 'medium',
    });
    expect(draft.proposedChanges).toContainEqual({
      type: 'selector-update',
      description: '价格字段选择器需要改为 .price-current',
    });
    expect(draft.executionSteps).toContain('更新模板字段或选择器');
    expect(draft.acceptanceCriteria).toContain('模板更新后通过一次任务试运行');
  });
});
