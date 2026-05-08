import Database from 'better-sqlite3';
import type {
  TaskRevisionRecord,
  TaskRevisionReviewStatus,
} from '@shared/types';

interface TaskRevisionRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface TaskRevisionRow {
  id: string;
  task_id: string;
  version: string;
  snapshot: string;
  change_summary: string | null;
  review_status: TaskRevisionReviewStatus;
  reviewer: string | null;
  created_by: string | null;
  created_at: string;
}

type TaskRevisionRepositoryInput = TaskRevisionRepositoryExecutor | Database.Database;

export class TaskRevisionRepository {
  private readonly executor: TaskRevisionRepositoryExecutor;

  constructor(executor: TaskRevisionRepositoryInput) {
    this.executor = toExecutor(executor);
  }

  createRevision(revision: TaskRevisionRecord): void {
    this.executor.run(
      `INSERT INTO task_revisions (
        id, task_id, version, snapshot, change_summary, review_status, reviewer, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        revision.id,
        revision.taskId,
        revision.version,
        revision.snapshot,
        revision.changeSummary ?? null,
        revision.reviewStatus,
        revision.reviewer ?? null,
        revision.createdBy ?? null,
        revision.createdAt,
      ],
    );
  }

  listRevisions(taskId: string): TaskRevisionRecord[] {
    return this.executor
      .all<TaskRevisionRow>(
        `SELECT id, task_id, version, snapshot, change_summary, review_status, reviewer, created_by, created_at
         FROM task_revisions
         WHERE task_id = ?
         ORDER BY created_at DESC`,
        [taskId],
      )
      .map(mapRevisionRow);
  }

  getRevision(revisionId: string): TaskRevisionRecord | null {
    const row = this.executor.get<TaskRevisionRow>(
      `SELECT id, task_id, version, snapshot, change_summary, review_status, reviewer, created_by, created_at
       FROM task_revisions
       WHERE id = ?`,
      [revisionId],
    );

    return row ? mapRevisionRow(row) : null;
  }

  updateReviewStatus(
    revisionId: string,
    updates: {
      reviewStatus: Extract<TaskRevisionReviewStatus, 'approved' | 'rejected'>;
      reviewer: string;
    },
  ): TaskRevisionRecord | null {
    this.executor.run(
      `UPDATE task_revisions
       SET review_status = ?, reviewer = ?
       WHERE id = ?`,
      [updates.reviewStatus, updates.reviewer, revisionId],
    );

    return this.getRevision(revisionId);
  }

  markCurrentRevision(taskId: string, revisionId: string): void {
    this.executor.run(
      `UPDATE tasks
       SET current_revision_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [revisionId, taskId],
    );
  }
}

function mapRevisionRow(row: TaskRevisionRow): TaskRevisionRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    version: row.version,
    snapshot: row.snapshot,
    changeSummary: row.change_summary,
    reviewStatus: row.review_status,
    reviewer: row.reviewer,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function isExecutor(
  input: TaskRevisionRepositoryInput,
): input is TaskRevisionRepositoryExecutor {
  return typeof (input as TaskRevisionRepositoryExecutor).all === 'function'
    && typeof (input as TaskRevisionRepositoryExecutor).get === 'function'
    && typeof (input as TaskRevisionRepositoryExecutor).run === 'function';
}

function toExecutor(input: TaskRevisionRepositoryInput): TaskRevisionRepositoryExecutor {
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
