import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { DatabaseService } from '@main/services/DatabaseService';
import { TaskRevisionRepository } from '@main/services/repositories/TaskRevisionRepository';

function createRepository() {
  const db = new Database(':memory:');
  new DatabaseService({ database: db }).migrate();
  db.prepare(
    `INSERT INTO tasks (id, name, description, flow_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'task-1',
    '采集任务',
    null,
    JSON.stringify({ steps: [], entryUrl: 'https://example.com' }),
    'idle',
    '2026-04-21T00:00:00.000Z',
    '2026-04-21T00:00:00.000Z',
  );
  return {
    db,
    repository: new TaskRevisionRepository(db),
  };
}

describe('TaskRevisionRepository', () => {
  it('creates and lists task revisions', () => {
    const { repository } = createRepository();

    repository.createRevision({
      id: 'revision-1',
      taskId: 'task-1',
      version: 'v1',
      snapshot: JSON.stringify({ id: 'task-1', steps: [] }),
      changeSummary: '初始化任务',
      reviewStatus: 'pending',
      reviewer: null,
      createdBy: 'alice',
      createdAt: '2026-04-21T00:00:00.000Z',
    });

    expect(repository.listRevisions('task-1')).toEqual([
      {
        id: 'revision-1',
        taskId: 'task-1',
        version: 'v1',
        snapshot: JSON.stringify({ id: 'task-1', steps: [] }),
        changeSummary: '初始化任务',
        reviewStatus: 'pending',
        reviewer: null,
        createdBy: 'alice',
        createdAt: '2026-04-21T00:00:00.000Z',
      },
    ]);
  });

  it('approves a revision and marks it as current on task', () => {
    const { db, repository } = createRepository();
    repository.createRevision({
      id: 'revision-1',
      taskId: 'task-1',
      version: 'v1',
      snapshot: '{}',
      changeSummary: null,
      reviewStatus: 'pending',
      reviewer: null,
      createdBy: 'alice',
      createdAt: '2026-04-21T00:00:00.000Z',
    });

    const revision = repository.updateReviewStatus('revision-1', {
      reviewStatus: 'approved',
      reviewer: 'owner',
    });
    repository.markCurrentRevision('task-1', 'revision-1');

    expect(revision?.reviewStatus).toBe('approved');
    expect(revision?.reviewer).toBe('owner');
    expect(
      db.prepare('SELECT current_revision_id as currentRevisionId FROM tasks WHERE id = ?')
        .get('task-1'),
    ).toEqual({ currentRevisionId: 'revision-1' });
  });
});
