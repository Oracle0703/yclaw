import Database from 'better-sqlite3';
import type { TaskReviewRecord } from '@shared/types';

interface ReviewRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
  get?<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface ReviewRow {
  id: string;
  task_id: string;
  batch_id?: string | null;
  review_type: TaskReviewRecord['reviewType'];
  reason_category?: string | null;
  conclusion?: string | null;
  owner?: string | null;
  follow_up_actions?: string | null;
  linked_template_ids?: string | null;
  created_at: string;
}

type ReviewRepositoryInput = ReviewRepositoryExecutor | Database.Database;

export class ReviewRepository {
  private readonly executor: ReviewRepositoryExecutor;

  constructor(executor: ReviewRepositoryInput) {
    this.executor = toExecutor(executor);
  }

  createReview(review: TaskReviewRecord): void {
    this.executor.run(
      `INSERT INTO task_reviews (
        id, task_id, batch_id, review_type, reason_category, conclusion, owner, follow_up_actions, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        review.id,
        review.taskId,
        review.batchId ?? null,
        review.reviewType,
        review.reasonCategory ?? null,
        review.conclusion ?? null,
        review.owner ?? null,
        JSON.stringify(review.followUpActions),
        review.createdAt,
      ],
    );
  }

  listReviews(query: { taskId?: string; batchId?: string } = {}): TaskReviewRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.taskId) {
      conditions.push('task_id = ?');
      params.push(query.taskId);
    }
    if (query.batchId) {
      conditions.push('batch_id = ?');
      params.push(query.batchId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.executor
      .all<ReviewRow>(
        `SELECT
           review.id,
           review.task_id,
           review.batch_id,
           review.review_type,
           review.reason_category,
           review.conclusion,
           review.owner,
           review.follow_up_actions,
           GROUP_CONCAT(link.template_id) AS linked_template_ids,
           review.created_at
         FROM task_reviews review
         LEFT JOIN template_review_links link ON link.review_id = review.id
         ${whereClause}
         GROUP BY
           review.id,
           review.task_id,
           review.batch_id,
           review.review_type,
           review.reason_category,
           review.conclusion,
           review.owner,
           review.follow_up_actions,
           review.created_at
         ORDER BY review.created_at DESC`,
        params,
      )
      .map(mapReviewRow);
  }

  getReview(reviewId: string): TaskReviewRecord | null {
    const row = this.executor.all<ReviewRow>(
      `SELECT
         review.id,
         review.task_id,
         review.batch_id,
         review.review_type,
         review.reason_category,
         review.conclusion,
         review.owner,
         review.follow_up_actions,
         GROUP_CONCAT(link.template_id) AS linked_template_ids,
         review.created_at
       FROM task_reviews review
       LEFT JOIN template_review_links link ON link.review_id = review.id
       WHERE review.id = ?
       GROUP BY
         review.id,
         review.task_id,
         review.batch_id,
         review.review_type,
         review.reason_category,
         review.conclusion,
         review.owner,
         review.follow_up_actions,
         review.created_at
       LIMIT 1`,
      [reviewId],
    )[0];

    return row ? mapReviewRow(row) : null;
  }

  linkTemplate(reviewId: string, templateId: string): void {
    this.executor.run(
      `INSERT INTO template_review_links (review_id, template_id, linked_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(review_id, template_id) DO NOTHING`,
      [reviewId, templateId],
    );
  }
}

function mapReviewRow(row: ReviewRow): TaskReviewRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    batchId: row.batch_id ?? null,
    reviewType: row.review_type,
    reasonCategory: row.reason_category ?? null,
    conclusion: row.conclusion ?? null,
    owner: row.owner ?? null,
    followUpActions: parseJson<string[]>(row.follow_up_actions, []),
    linkedTemplateIds: row.linked_template_ids
      ? row.linked_template_ids.split(',').filter((item) => item.length > 0)
      : [],
    createdAt: row.created_at,
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isExecutor(input: ReviewRepositoryInput): input is ReviewRepositoryExecutor {
  return typeof (input as ReviewRepositoryExecutor).all === 'function'
    && typeof (input as ReviewRepositoryExecutor).run === 'function';
}

function toExecutor(input: ReviewRepositoryInput): ReviewRepositoryExecutor {
  if (isExecutor(input)) {
    return input;
  }

  return {
    all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      const statement = input.prepare(sql);
      return (params ? statement.all(...params) : statement.all()) as T[];
    },
    get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
      const statement = input.prepare(sql);
      return (params ? statement.get(...params) : statement.get()) as T | undefined;
    },
    run(sql: string, params?: unknown[]): { changes?: number } {
      const statement = input.prepare(sql);
      return params ? statement.run(...params) : statement.run();
    },
  };
}
