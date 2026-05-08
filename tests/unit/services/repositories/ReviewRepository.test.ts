import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewRepository } from '@main/services/repositories/ReviewRepository';

function createExecutor() {
  return {
    run: vi.fn(),
    all: vi.fn(),
  };
}

describe('ReviewRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: ReviewRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new ReviewRepository(executor);
  });

  it('creates and lists task reviews', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'review-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        review_type: 'failure',
        reason_category: 'selector_changed',
        conclusion: '更新模板选择器',
        owner: 'alice',
        follow_up_actions: JSON.stringify(['update-template']),
        linked_template_ids: null,
        created_at: '2026-04-21T00:00:00.000Z',
      },
    ]);

    repository.createReview({
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

    expect(repository.listReviews({ taskId: 'task-1' })).toEqual([
      expect.objectContaining({
        id: 'review-1',
        taskId: 'task-1',
        reviewType: 'failure',
        conclusion: '更新模板选择器',
      }),
    ]);
    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO task_reviews'),
      [
        'review-1',
        'task-1',
        'batch-1',
        'failure',
        'selector_changed',
        '更新模板选择器',
        'alice',
        JSON.stringify(['update-template']),
        '2026-04-21T00:00:00.000Z',
      ],
    );
  });

  it('returns linked template ids for reviews', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'review-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        review_type: 'failure',
        reason_category: 'selector_changed',
        conclusion: '更新模板选择器',
        owner: 'alice',
        follow_up_actions: JSON.stringify(['update-template']),
        linked_template_ids: 'template-1',
        created_at: '2026-04-21T00:00:00.000Z',
      },
    ]);

    repository.linkTemplate('review-1', 'template-1');

    expect(repository.listReviews({ taskId: 'task-1' })).toEqual([
      expect.objectContaining({
        id: 'review-1',
        linkedTemplateIds: ['template-1'],
      }),
    ]);
    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO template_review_links'),
      ['review-1', 'template-1'],
    );
  });

  it('fetches one review for backflow suggestions', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'review-1',
        task_id: 'task-1',
        batch_id: 'batch-1',
        review_type: 'failure',
        reason_category: 'selector_changed',
        conclusion: '更新模板选择器',
        owner: 'alice',
        follow_up_actions: JSON.stringify(['update-template']),
        linked_template_ids: 'template-1',
        created_at: '2026-04-21T00:00:00.000Z',
      },
    ]);

    expect(repository.getReview('review-1')).toEqual(
      expect.objectContaining({
        id: 'review-1',
        followUpActions: ['update-template'],
      }),
    );
  });
});
