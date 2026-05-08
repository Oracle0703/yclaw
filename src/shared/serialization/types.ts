/**
 * Task-as-Code v1 序列化层 — 文件格式类型
 *
 * 设计原则：
 * 1. 与运行时类型（src/shared/types/task.ts）解耦，文件结构是稳定契约。
 * 2. 用户可读的 YAML 友好结构（顶层 metadata + spec 分离），不暴露 DB 内部字段。
 * 3. 通过 `schemaVersion` 显式管理演进；当前 v1。
 * 4. 不导出运行时数据（batches/results/logs）。
 *
 * 对应 spec：docs/specs/task-as-code-v1.md
 */

export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

/** 文件 kind 枚举 */
export type FileKind = 'Task' | 'Template';

/** 通用 metadata 结构 */
export interface FileMetadata {
  /** 业务主键，全局唯一；导入时用于 upsert */
  id: string;
  /** 人类可读名称 */
  name: string;
  /** 可选标签 */
  tags?: string[];
  /** 自由备注 */
  description?: string;
}

/** 步骤 action（与运行时 TaskAction 对齐，但保持自治） */
export interface TaskActionFile {
  type: 'click' | 'input' | 'scroll' | 'extract' | 'screenshot';
  selector: string;
  params?: Record<string, unknown>;
  timeout?: number;
}

/** 任务步骤 */
export interface TaskStepFile {
  id: string;
  name: string;
  action: TaskActionFile;
  retryCount?: number;
  retryDelay?: number;
}

/** 调度配置 */
export interface ScheduleFile {
  type: 'manual' | 'once' | 'cron';
  cron?: string;
  runAt?: string;
  timeoutMs?: number;
  maxConcurrency?: number;
}

/** Task 文件 spec */
export interface TaskFileSpec {
  /** 入口 URL（可选，多步任务可不写） */
  entryUrl?: string;
  /** 步骤列表 */
  steps: TaskStepFile[];
  /** 调度配置；不填即手动触发 */
  schedule?: ScheduleFile;
  /** 引用模板 metadata.id（不是 DB 内部 id） */
  templateRef?: string;
  /** 引用 session metadata.id */
  sessionRef?: string;
  /** 是否启用，默认 true */
  enabled?: boolean;
  /**
   * 敏感字段引用：值必须形如 `${env:VAR_NAME}`。
   * 导出时绝不写入明文；运行时由调用方解析。
   */
  secrets?: Record<string, string>;
}

/** Task 文件根结构 */
export interface TaskFile {
  schemaVersion: SchemaVersion;
  kind: 'Task';
  metadata: FileMetadata;
  spec: TaskFileSpec;
}

/** 模板字段 */
export interface TemplateFieldFile {
  name: string;
  selector: string;
  attribute: string;
  transform?: string;
}

/** Template 文件 spec */
export interface TemplateFileSpec {
  fields: TemplateFieldFile[];
}

/** Template 文件根结构 */
export interface TemplateFile {
  schemaVersion: SchemaVersion;
  kind: 'Template';
  metadata: FileMetadata;
  spec: TemplateFileSpec;
}

/** 任意文件类型联合 */
export type AnyFile = TaskFile | TemplateFile;
