import { randomUUID } from 'crypto';
import type {
  PublishTaskRevisionInput,
  ReviewTaskRevisionInput,
  TaskFlow,
  TaskRevisionComparison,
  TaskRevisionRecord,
} from '@shared/types';
import { TaskRepository, TaskRevisionRepository } from './repositories';

export interface TaskRevisionServiceOptions {
  taskRepository?: Pick<TaskRepository, 'getTaskFlow'>;
  revisionRepository?: Pick<
    TaskRevisionRepository,
    | 'createRevision'
    | 'listRevisions'
    | 'getRevision'
    | 'updateReviewStatus'
    | 'markCurrentRevision'
  >;
}

export class TaskRevisionService {
  private readonly taskRepository: NonNullable<TaskRevisionServiceOptions['taskRepository']>;
  private readonly revisionRepository: NonNullable<TaskRevisionServiceOptions['revisionRepository']>;

  constructor(options: TaskRevisionServiceOptions = {}) {
    if (!options.taskRepository) {
      throw new Error('taskRepository is required');
    }
    if (!options.revisionRepository) {
      throw new Error('revisionRepository is required');
    }

    this.taskRepository = options.taskRepository;
    this.revisionRepository = options.revisionRepository;
  }

  publishRevision(taskId: string, input: PublishTaskRevisionInput): TaskRevisionRecord {
    const flow = this.taskRepository.getTaskFlow(taskId);
    if (!flow) {
      throw new Error(`Task "${taskId}" not found`);
    }

    const revision: TaskRevisionRecord = {
      id: randomUUID(),
      taskId,
      version: input.version,
      snapshot: JSON.stringify(normalizeTaskSnapshot(flow)),
      changeSummary: input.changeSummary ?? null,
      reviewStatus: 'pending',
      reviewer: null,
      createdBy: input.createdBy ?? null,
      createdAt: new Date().toISOString(),
    };

    this.revisionRepository.createRevision(revision);

    return revision;
  }

  listRevisions(taskId: string): TaskRevisionRecord[] {
    return this.revisionRepository.listRevisions(taskId);
  }

  reviewRevision(revisionId: string, input: ReviewTaskRevisionInput): TaskRevisionRecord {
    const existing = this.revisionRepository.getRevision(revisionId);
    if (!existing) {
      throw new Error(`Task revision "${revisionId}" not found`);
    }

    const reviewStatus = input.action === 'approve' ? 'approved' : 'rejected';
    const updated = this.revisionRepository.updateReviewStatus(revisionId, {
      reviewStatus,
      reviewer: input.reviewer,
    });
    if (!updated) {
      throw new Error(`Task revision "${revisionId}" not found`);
    }

    if (reviewStatus === 'approved') {
      this.revisionRepository.markCurrentRevision(updated.taskId, updated.id);
    }

    return updated;
  }

  compareRevisions(baseRevisionId: string, targetRevisionId: string): TaskRevisionComparison {
    const baseRevision = this.revisionRepository.getRevision(baseRevisionId);
    if (!baseRevision) {
      throw new Error(`Task revision "${baseRevisionId}" not found`);
    }

    const targetRevision = this.revisionRepository.getRevision(targetRevisionId);
    if (!targetRevision) {
      throw new Error(`Task revision "${targetRevisionId}" not found`);
    }

    const baseSnapshot = parseRevisionSnapshot(baseRevision.snapshot);
    const targetSnapshot = parseRevisionSnapshot(targetRevision.snapshot);

    return {
      baseRevisionId,
      targetRevisionId,
      changes: [
        ...compareScalar('name', baseSnapshot.name, targetSnapshot.name),
        ...compareScalar('description', baseSnapshot.description, targetSnapshot.description),
        ...compareScalar('entryUrl', baseSnapshot.entryUrl, targetSnapshot.entryUrl),
        ...compareScalar('steps.length', baseSnapshot.steps?.length, targetSnapshot.steps?.length),
      ],
    };
  }
}

function normalizeTaskSnapshot(flow: TaskFlow): TaskFlow {
  return {
    ...flow,
    updatedAt: flow.updatedAt,
  };
}

function parseRevisionSnapshot(snapshot: string): Partial<TaskFlow> {
  try {
    return JSON.parse(snapshot) as Partial<TaskFlow>;
  } catch {
    return {};
  }
}

function compareScalar(
  path: string,
  before: unknown,
  after: unknown,
): TaskRevisionComparison['changes'] {
  if (before === after) {
    return [];
  }

  return [{
    path,
    before,
    after,
    changeType: before === undefined ? 'added' : after === undefined ? 'removed' : 'updated',
  }];
}
