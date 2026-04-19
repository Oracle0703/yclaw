/**
 * Task-as-Code · Repository → Persistence 适配器
 *
 * 把 `TaskRepository.saveTaskFlow` 与 `TemplateRepository.saveTemplate` 装配为
 * `TaskAsCodeService` 期望的 `Persistence` 接口；同时透出 createdAt 查询用于幂等导入。
 *
 * 仅依赖两个 Repository 的最小子集，便于单测注入 mock。
 */

import type { Persistence } from '@shared/serialization/service';
import type { TaskFlow, ExtractionTemplate } from '@shared/types/task';

export interface TaskRepositoryLike {
  saveTaskFlow(flow: TaskFlow): void;
  getTaskCreatedAt(taskId: string): string | null;
}

export interface TemplateRepositoryLike {
  saveTemplate(template: ExtractionTemplate): ExtractionTemplate;
  getTemplateCreatedAt(templateId: string): string | null;
}

export interface RepositoryPersistenceDeps {
  taskRepository: TaskRepositoryLike;
  templateRepository: TemplateRepositoryLike;
}

/** 创建一个 `Persistence` 适配器；upsert 委派至 saveTaskFlow / saveTemplate，find* 走 createdAt 查询。
 *
 * 返回对象被 `Object.freeze` 以避免使用方在运行期偷换钩子（如调试时误覆盖 upsertTask）。
 */
export function createRepositoryPersistence(deps: RepositoryPersistenceDeps): Persistence {
  const { taskRepository, templateRepository } = deps;
  return Object.freeze({
    upsertTask: (flow) => { taskRepository.saveTaskFlow(flow); },
    upsertTemplate: (tpl) => { templateRepository.saveTemplate(tpl); },
    findExistingTaskCreatedAt: (id) => taskRepository.getTaskCreatedAt(id),
    findExistingTemplateCreatedAt: (id) => templateRepository.getTemplateCreatedAt(id),
  } satisfies Persistence);
}
