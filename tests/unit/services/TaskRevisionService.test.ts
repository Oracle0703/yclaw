import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskFlow } from '@shared/types';
import { TaskRevisionService } from '@main/services/TaskRevisionService';

const task: TaskFlow = {
  id: 'task-1',
  name: '采集任务',
  steps: [],
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
};

const mockTaskRepository = {
  getTaskFlow: vi.fn(),
};

const mockRevisionRepository = {
  createRevision: vi.fn(),
  listRevisions: vi.fn(),
  getRevision: vi.fn(),
  updateReviewStatus: vi.fn(),
  markCurrentRevision: vi.fn(),
};

describe('TaskRevisionService', () => {
  let service: TaskRevisionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaskRevisionService({
      taskRepository: mockTaskRepository,
      revisionRepository: mockRevisionRepository,
    });
  });

  it('requires repository injection', () => {
    expect(() => new TaskRevisionService()).toThrow('taskRepository is required');
  });

  it('publishes a pending revision snapshot from current task flow', () => {
    mockTaskRepository.getTaskFlow.mockReturnValueOnce(task);
    mockRevisionRepository.createRevision.mockImplementationOnce((revision) => revision);

    const revision = service.publishRevision('task-1', {
      version: 'v1',
      changeSummary: '初始化任务',
      createdBy: 'alice',
    });

    expect(revision.taskId).toBe('task-1');
    expect(revision.reviewStatus).toBe('pending');
    expect(JSON.parse(revision.snapshot)).toMatchObject({ id: 'task-1', name: '采集任务' });
  });

  it('approves a pending revision and marks it active', () => {
    mockRevisionRepository.getRevision.mockReturnValueOnce({
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
    mockRevisionRepository.updateReviewStatus.mockReturnValueOnce({
      id: 'revision-1',
      taskId: 'task-1',
      version: 'v1',
      snapshot: '{}',
      changeSummary: null,
      reviewStatus: 'approved',
      reviewer: 'owner',
      createdBy: 'alice',
      createdAt: '2026-04-21T00:00:00.000Z',
    });

    const revision = service.reviewRevision('revision-1', {
      action: 'approve',
      reviewer: 'owner',
    });

    expect(revision.reviewStatus).toBe('approved');
    expect(mockRevisionRepository.markCurrentRevision).toHaveBeenCalledWith(
      'task-1',
      'revision-1',
    );
  });

  it('compares two revision snapshots for review', () => {
    mockRevisionRepository.getRevision
      .mockReturnValueOnce({
        id: 'revision-1',
        taskId: 'task-1',
        version: 'v1',
        snapshot: JSON.stringify({
          id: 'task-1',
          name: '旧任务',
          steps: [{ id: 'step-1', name: '打开页面' }],
        }),
        changeSummary: null,
        reviewStatus: 'approved',
        reviewer: 'owner',
        createdBy: 'alice',
        createdAt: '2026-04-20T00:00:00.000Z',
      })
      .mockReturnValueOnce({
        id: 'revision-2',
        taskId: 'task-1',
        version: 'v2',
        snapshot: JSON.stringify({
          id: 'task-1',
          name: '新任务',
          steps: [
            { id: 'step-1', name: '打开页面' },
            { id: 'step-2', name: '采集价格' },
          ],
        }),
        changeSummary: null,
        reviewStatus: 'pending',
        reviewer: null,
        createdBy: 'bob',
        createdAt: '2026-04-21T00:00:00.000Z',
      });

    const comparison = service.compareRevisions('revision-1', 'revision-2');

    expect(comparison).toMatchObject({
      baseRevisionId: 'revision-1',
      targetRevisionId: 'revision-2',
    });
    expect(comparison.changes).toContainEqual({
      path: 'name',
      before: '旧任务',
      after: '新任务',
      changeType: 'updated',
    });
    expect(comparison.changes).toContainEqual({
      path: 'steps.length',
      before: 1,
      after: 2,
      changeType: 'updated',
    });
  });
});
