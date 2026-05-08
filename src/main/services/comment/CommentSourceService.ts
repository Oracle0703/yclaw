import { randomUUID } from 'crypto';
import type { CommentCrawlLimits, CommentSource, CommentSourceDraft, TaskFlow } from '@shared/types';
import { CommentTaskCompiler, DEFAULT_COMMENT_LIMITS } from './CommentTaskCompiler';
import type { CommentSourceRepository } from '../repositories/CommentSourceRepository';
import type { TaskService } from '../TaskService';

interface CommentSourceServiceOptions {
  sourceRepository?: Pick<CommentSourceRepository, 'listSources' | 'getSource' | 'saveSource' | 'deleteSource'>;
  taskService?: Pick<TaskService, 'createTask' | 'updateTaskFlow' | 'deleteTask'>;
  taskCompiler?: Pick<CommentTaskCompiler, 'compile'>;
  now?: () => Date;
  createId?: () => string;
}

export class CommentSourceService {
  private readonly sourceRepository: Pick<CommentSourceRepository, 'listSources' | 'getSource' | 'saveSource' | 'deleteSource'>;
  private readonly taskService: Pick<TaskService, 'createTask' | 'updateTaskFlow' | 'deleteTask'>;
  private readonly taskCompiler: Pick<CommentTaskCompiler, 'compile'>;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: CommentSourceServiceOptions = {}) {
    if (!options.sourceRepository) throw new Error('sourceRepository is required');
    if (!options.taskService) throw new Error('taskService is required');
    if (!options.taskCompiler) throw new Error('taskCompiler is required');

    this.sourceRepository = options.sourceRepository;
    this.taskService = options.taskService;
    this.taskCompiler = options.taskCompiler;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
  }

  listSources(): CommentSource[] {
    return this.sourceRepository.listSources();
  }

  getSource(sourceId: string): CommentSource | null {
    return this.sourceRepository.getSource(sourceId);
  }

  createSource(draft: CommentSourceDraft): CommentSource {
    const nowIso = this.now().toISOString();
    const source = this.normalizeDraft(draft, {
      id: this.createId(),
      taskId: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const compiled = this.taskCompiler.compile(source);
    const task = this.taskService.createTask(this.toTaskPayload(compiled));
    const saved: CommentSource = {
      ...source,
      taskId: task.id,
    };
    this.sourceRepository.saveSource(saved);
    return saved;
  }

  updateSource(sourceId: string, updates: CommentSourceDraft): CommentSource {
    const existing = this.sourceRepository.getSource(sourceId);
    if (!existing) {
      throw new Error(`Comment source "${sourceId}" not found`);
    }

    const merged = this.normalizeDraft(updates, {
      ...existing,
      updatedAt: this.now().toISOString(),
    });
    const compiled = this.taskCompiler.compile(merged);
    this.taskService.updateTaskFlow(existing.taskId, this.toTaskPayload(compiled));
    this.sourceRepository.saveSource(merged);
    return merged;
  }

  deleteSource(sourceId: string): void {
    const existing = this.sourceRepository.getSource(sourceId);
    if (!existing) return;

    this.taskService.deleteTask(existing.taskId);
    this.sourceRepository.deleteSource(sourceId);
  }

  private normalizeDraft(
    draft: CommentSourceDraft,
    base: Pick<CommentSource, 'id' | 'taskId' | 'createdAt' | 'updatedAt'> & Partial<CommentSource>,
  ): CommentSource {
    if (draft.platform !== 'xhs') {
      throw new Error('Unsupported comment platform');
    }
    if (!draft.entryValue?.trim()) {
      throw new Error('entryValue is required');
    }

    return {
      id: base.id,
      taskId: base.taskId,
      name: draft.name,
      platform: draft.platform,
      entryKind: draft.entryKind,
      entryValue: draft.entryValue.trim(),
      parserKey: draft.parserKey ?? base.parserKey ?? 'xhs.comment',
      sessionId: draft.sessionId ?? base.sessionId ?? null,
      schedule: draft.schedule ?? base.schedule ?? { type: 'manual' },
      limits: normalizeLimits(draft.limits ?? base.limits),
      filter: draft.filter ?? base.filter ?? null,
      enabled: draft.enabled ?? base.enabled ?? true,
      tags: draft.tags ?? base.tags ?? [],
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
    };
  }

  private toTaskPayload(compiled: Pick<TaskFlow, 'name' | 'description' | 'entryUrl' | 'schedule' | 'sessionId' | 'enabled' | 'tags' | 'steps'>) {
    return {
      name: compiled.name,
      description: compiled.description,
      entryUrl: compiled.entryUrl,
      schedule: compiled.schedule,
      sessionId: compiled.sessionId ?? null,
      enabled: compiled.enabled ?? true,
      tags: compiled.tags ?? [],
      steps: compiled.steps,
    };
  }
}

function normalizeLimits(limits?: Partial<CommentCrawlLimits> | null): CommentCrawlLimits {
  return {
    ...DEFAULT_COMMENT_LIMITS,
    ...(limits ?? {}),
  };
}
