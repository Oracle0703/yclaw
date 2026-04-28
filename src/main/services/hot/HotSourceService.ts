import { randomUUID } from 'crypto';
import type { HotSource, HotSourceDraft, TaskFlow } from '@shared/types';
import { HotTaskCompiler } from './HotTaskCompiler';
import type { HotSourceRepository } from '../repositories/HotSourceRepository';
import type { TaskService } from '../TaskService';

interface HotSourceServiceOptions {
  sourceRepository?: Pick<HotSourceRepository, 'listSources' | 'getSource' | 'saveSource' | 'deleteSource'>;
  taskService?: Pick<TaskService, 'createTask' | 'updateTaskFlow' | 'deleteTask'>;
  taskCompiler?: Pick<HotTaskCompiler, 'compile'>;
  now?: () => Date;
  createId?: () => string;
}

export class HotSourceService {
  private readonly sourceRepository: Pick<HotSourceRepository, 'listSources' | 'getSource' | 'saveSource' | 'deleteSource'>;
  private readonly taskService: Pick<TaskService, 'createTask' | 'updateTaskFlow' | 'deleteTask'>;
  private readonly taskCompiler: Pick<HotTaskCompiler, 'compile'>;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: HotSourceServiceOptions = {}) {
    if (!options.sourceRepository) {
      throw new Error('sourceRepository is required');
    }
    if (!options.taskService) {
      throw new Error('taskService is required');
    }
    if (!options.taskCompiler) {
      throw new Error('taskCompiler is required');
    }

    this.sourceRepository = options.sourceRepository;
    this.taskService = options.taskService;
    this.taskCompiler = options.taskCompiler;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
  }

  listSources(): HotSource[] {
    return this.sourceRepository.listSources();
  }

  getSource(sourceId: string): HotSource | null {
    return this.sourceRepository.getSource(sourceId);
  }

  createSource(draft: HotSourceDraft): HotSource {
    const compiled = this.taskCompiler.compile(this.normalizeDraft(draft));
    const task = this.taskService.createTask(this.toTaskPayload(compiled));
    const nowIso = this.now().toISOString();
    const source: HotSource = {
      id: this.createId(),
      taskId: task.id,
      name: draft.name,
      sourceKind: draft.sourceKind,
      siteKey: draft.siteKey,
      entryUrl: draft.entryUrl,
      parserKey: draft.parserKey,
      sessionId: draft.sessionId ?? null,
      schedule: draft.schedule ?? { type: 'manual' },
      enabled: draft.enabled ?? true,
      tags: draft.tags ?? [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.sourceRepository.saveSource(source);
    return source;
  }

  updateSource(sourceId: string, updates: HotSourceDraft): HotSource {
    const existing = this.sourceRepository.getSource(sourceId);
    if (!existing) {
      throw new Error(`Hot source "${sourceId}" not found`);
    }

    const merged = this.normalizeDraft({
      name: updates.name,
      sourceKind: updates.sourceKind,
      siteKey: updates.siteKey,
      entryUrl: updates.entryUrl,
      parserKey: updates.parserKey,
      sessionId: updates.sessionId ?? null,
      schedule: updates.schedule ?? existing.schedule ?? { type: 'manual' },
      enabled: updates.enabled ?? existing.enabled,
      tags: updates.tags ?? existing.tags,
    });
    const compiled = this.taskCompiler.compile(merged);
    this.taskService.updateTaskFlow(existing.taskId, this.toTaskPayload(compiled));

    const nextSource: HotSource = {
      ...existing,
      ...merged,
      updatedAt: this.now().toISOString(),
    };
    this.sourceRepository.saveSource(nextSource);
    return nextSource;
  }

  deleteSource(sourceId: string): void {
    const existing = this.sourceRepository.getSource(sourceId);
    if (!existing) {
      return;
    }

    this.taskService.deleteTask(existing.taskId);
    this.sourceRepository.deleteSource(sourceId);
  }

  private normalizeDraft(draft: HotSourceDraft): HotSourceDraft {
    return {
      ...draft,
      sessionId: draft.sessionId ?? null,
      schedule: draft.schedule ?? { type: 'manual' },
      enabled: draft.enabled ?? true,
      tags: draft.tags ?? [],
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
