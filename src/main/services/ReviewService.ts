import { randomUUID } from 'crypto';
import type {
  CreateTaskReviewInput,
  TaskReviewRecord,
  TemplateBackflowChangeType,
  TemplateBackflowDraft,
  TemplateBackflowRiskLevel,
} from '@shared/types';
import { ReviewRepository } from './repositories';

export interface ReviewServiceOptions {
  reviewRepository?: Pick<ReviewRepository, 'createReview' | 'listReviews' | 'getReview'>;
}

export interface TemplateBackflowSuggestion {
  reviewId: string;
  templateId: string;
  recommended: boolean;
  reason: string;
  followUpActions: string[];
}

export class ReviewService {
  private readonly reviewRepository: NonNullable<ReviewServiceOptions['reviewRepository']>;

  constructor(options: ReviewServiceOptions = {}) {
    if (!options.reviewRepository) {
      throw new Error('reviewRepository is required');
    }

    this.reviewRepository = options.reviewRepository;
  }

  createReview(input: CreateTaskReviewInput): TaskReviewRecord {
    const review: TaskReviewRecord = {
      id: randomUUID(),
      taskId: input.taskId,
      batchId: input.batchId ?? null,
      reviewType: input.reviewType,
      reasonCategory: input.reasonCategory ?? null,
      conclusion: input.conclusion ?? null,
      owner: input.owner ?? null,
      followUpActions: input.followUpActions ?? [],
      createdAt: new Date().toISOString(),
    };

    this.reviewRepository.createReview(review);

    return review;
  }

  listReviews(query: { taskId?: string; batchId?: string } = {}): TaskReviewRecord[] {
    return this.reviewRepository.listReviews(query);
  }

  suggestTemplateBackflow(reviewId: string, templateId: string): TemplateBackflowSuggestion {
    const review = this.reviewRepository.getReview(reviewId);
    if (!review) {
      throw new Error(`Task review "${reviewId}" not found`);
    }

    const hasTemplateAction = review.followUpActions.some((action) =>
      ['update-template', 'link-template', 'template-governance'].includes(action),
    );

    return {
      reviewId,
      templateId,
      recommended: hasTemplateAction,
      reason: hasTemplateAction
        ? `复盘后续动作包含 ${review.followUpActions.join(', ')}，建议将结论回流到模板。`
        : '当前复盘未声明模板治理动作，可先补充后续动作再回流。',
      followUpActions: review.followUpActions,
    };
  }

  createTemplateBackflowDraft(reviewId: string, templateId: string): TemplateBackflowDraft {
    const review = this.reviewRepository.getReview(reviewId);
    if (!review) {
      throw new Error(`Task review "${reviewId}" not found`);
    }

    const description = review.conclusion
      ?? review.reasonCategory
      ?? `复盘动作：${review.followUpActions.join(', ') || '补充模板治理项'}`;

    return {
      reviewId,
      templateId,
      title: '回流复盘结论到模板',
      status: 'draft',
      riskLevel: resolveRiskLevel(review),
      proposedChanges: [
        {
          type: resolveChangeType(review),
          description,
        },
      ],
      executionSteps: resolveExecutionSteps(review),
      acceptanceCriteria: [
        '模板更新后通过一次任务试运行',
        '复盘记录与模板保持关联',
      ],
      sourceConclusion: review.conclusion ?? null,
      owner: review.owner ?? null,
    };
  }
}

function resolveChangeType(review: TaskReviewRecord): TemplateBackflowChangeType {
  const text = [
    review.reasonCategory,
    review.conclusion,
    ...review.followUpActions,
  ].filter(Boolean).join(' ');

  if (/selector|选择器/i.test(text)) {
    return 'selector-update';
  }

  if (/quality|质检|校验|check/i.test(text)) {
    return 'quality-rule';
  }

  if (/field|字段/i.test(text)) {
    return 'field-update';
  }

  return 'checklist-update';
}

function resolveRiskLevel(review: TaskReviewRecord): TemplateBackflowRiskLevel {
  if (review.reviewType === 'failure' && review.followUpActions.includes('update-template')) {
    return 'medium';
  }

  if (review.reviewType === 'strategy') {
    return 'high';
  }

  return 'low';
}

function resolveExecutionSteps(review: TaskReviewRecord): string[] {
  const steps = ['更新模板字段或选择器'];

  if (review.followUpActions.includes('add-quality-check')) {
    steps.push('补充模板级质量校验');
  }

  steps.push('关联复盘记录并记录变更原因');

  return steps;
}
