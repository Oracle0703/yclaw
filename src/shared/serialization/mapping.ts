/**
 * Task-as-Code v1 — 与运行时类型互转
 *
 * 这里把「文件结构 ↔ 运行时业务结构」的边界封装成纯函数。
 * 与 DB / Service 层完全解耦，便于测试。
 *
 * - taskFromFile / taskToFile：TaskFile ↔ TaskFlow（src/shared/types/task.ts）
 * - templateFromFile / templateToFile：TemplateFile ↔ ExtractionTemplate
 *
 * 转换规则：
 * - 时间戳：导入时若 metadata 不带，则由调用方补 createdAt / updatedAt；
 *   反向导出时不写入 createdAt / updatedAt（属于运行时数据）。
 * - secrets：在 TaskFlow 中无对应字段，仅保留在文件层；调用方运行时通过
 *   resolveSecrets() 读取。
 */

import type {
  ExtractionTemplate,
  ScheduleConfig,
  TaskAction,
  TaskFlow,
  TaskStep,
} from '@shared/types';
import {
  SCHEMA_VERSION,
  type ScheduleFile,
  type TaskFile,
  type TaskStepFile,
  type TemplateFieldFile,
  type TemplateFile,
} from './types';

export interface FromFileTimestamps {
  /** 当文件中没有时间信息时使用 */
  now: string;
  /** 已有运行时记录的 createdAt（用于 upsert 时保留） */
  existingCreatedAt?: string;
}

/** 把 TaskFile 转为可写入 DB 的 TaskFlow */
export function taskFromFile(file: TaskFile, ts: FromFileTimestamps): TaskFlow {
  return {
    id: file.metadata.id,
    name: file.metadata.name,
    description: file.metadata.description,
    steps: file.spec.steps.map(stepFromFile),
    entryUrl: file.spec.entryUrl,
    schedule: file.spec.schedule ? scheduleFromFile(file.spec.schedule) : null,
    sessionId: file.spec.sessionRef ?? null,
    templateId: file.spec.templateRef ?? null,
    enabled: file.spec.enabled ?? true,
    tags: file.metadata.tags,
    createdAt: ts.existingCreatedAt ?? ts.now,
    updatedAt: ts.now,
  };
}

/** 把运行时 TaskFlow 序列化为 TaskFile（不含运行时数据） */
export function taskToFile(
  flow: TaskFlow,
  options: { secrets?: Record<string, string> } = {},
): TaskFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Task',
    metadata: {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      tags: flow.tags && flow.tags.length > 0 ? flow.tags : undefined,
    },
    spec: {
      entryUrl: flow.entryUrl,
      steps: flow.steps.map(stepToFile),
      schedule: flow.schedule ? scheduleToFile(flow.schedule) : undefined,
      templateRef: flow.templateId ?? undefined,
      sessionRef: flow.sessionId ?? undefined,
      enabled: flow.enabled === false ? false : undefined,
      secrets: options.secrets && Object.keys(options.secrets).length > 0 ? options.secrets : undefined,
    },
  };
}

export function templateFromFile(
  file: TemplateFile,
  ts: FromFileTimestamps,
): ExtractionTemplate {
  return {
    id: file.metadata.id,
    name: file.metadata.name,
    fields: file.spec.fields.map(fieldFromFile),
    createdAt: ts.existingCreatedAt ?? ts.now,
    updatedAt: ts.now,
  };
}

export function templateToFile(template: ExtractionTemplate): TemplateFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Template',
    metadata: {
      id: template.id,
      name: template.name,
    },
    spec: {
      fields: template.fields.map(fieldToFile),
    },
  };
}

// ───────────────── 子结构转换 ─────────────────

function stepFromFile(step: TaskStepFile): TaskStep {
  return {
    id: step.id,
    name: step.name,
    action: actionFromFile(step.action),
    retryCount: step.retryCount,
    retryDelay: step.retryDelay,
  };
}

function stepToFile(step: TaskStep): TaskStepFile {
  return {
    id: step.id,
    name: step.name,
    action: actionToFile(step.action),
    retryCount: step.retryCount,
    retryDelay: step.retryDelay,
  };
}

function actionFromFile(action: TaskStepFile['action']): TaskAction {
  return {
    type: action.type,
    selector: action.selector,
    params: action.params,
    timeout: action.timeout,
  };
}

function actionToFile(action: TaskAction): TaskStepFile['action'] {
  return {
    type: action.type,
    selector: action.selector,
    params: action.params,
    timeout: action.timeout,
  };
}

function scheduleFromFile(schedule: ScheduleFile): ScheduleConfig {
  return {
    type: schedule.type,
    cron: schedule.cron,
    runAt: schedule.runAt,
    timeoutMs: schedule.timeoutMs,
    maxConcurrency: schedule.maxConcurrency,
  };
}

function scheduleToFile(schedule: ScheduleConfig): ScheduleFile {
  return {
    type: schedule.type,
    cron: schedule.cron,
    runAt: schedule.runAt,
    timeoutMs: schedule.timeoutMs,
    maxConcurrency: schedule.maxConcurrency,
  };
}

function fieldFromFile(field: TemplateFieldFile): ExtractionTemplate['fields'][number] {
  return {
    name: field.name,
    selector: field.selector,
    attribute: field.attribute,
    transform: field.transform,
  };
}

function fieldToFile(field: ExtractionTemplate['fields'][number]): TemplateFieldFile {
  return {
    name: field.name,
    selector: field.selector,
    attribute: field.attribute,
    transform: field.transform,
  };
}
