/**
 * Task-as-Code v1 — 高层服务 facade
 *
 * 把 loader / mapping / migrate / watcher 串成可被 IPC / UI 直接调用的接口。
 * 通过 `Persistence` 适配器对接业务存储（DB / Repository），无 Electron 依赖。
 *
 * 设计取舍：
 * - 所有 IO 走可注入的 deps，便于单元测试。
 * - 任意 issue 都通过返回值 `issues` 暴露，不抛错（除非确实无法继续）。
 * - 监听仅返回受影响的 id 列表，由调用方决定何时重新 import。
 */

import { promises as fsp } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { parseFileMigrating, serializeFile } from './yaml';
import {
  taskFromFile,
  taskToFile,
  templateFromFile,
  templateToFile,
  type FromFileTimestamps,
} from './mapping';
import {
  loadDirectory,
  resolveReferences,
  LOADER_SAFETY,
  type LoadOptions,
  type Registry,
} from './loader';
import { createWatcher, type Watcher, type WatcherOptions, type WatchEvent } from './watcher';
import type { ValidationIssue } from './validate';
import type { AnyFile } from './types';
import type { ExtractionTemplate, TaskFlow } from '@shared/types/task';

/** 调用方注入的「持久化」适配器；service 不假设 DB 形态。
 *
 * 实现幂等性（TAC-02）：可选提供 `findExistingTaskCreatedAt` /
 * `findExistingTemplateCreatedAt`，service 会以其返回值作为 `createdAt`，
 * 这样同一文件反复 import 不会刷新创建时间。
 *
 * 钩子契约：返回非空 ISO 字符串 = 既存；返回 `null` / `undefined` / 空字符串 = 不存在；
 * 抛出异常会被 service 吞掉并视为不存在（保证 importPath 不被诊断查询拖垮）。
 */
export interface Persistence {
  upsertTask: (flow: TaskFlow) => Promise<void> | void;
  upsertTemplate: (template: ExtractionTemplate) => Promise<void> | void;
  findExistingTaskCreatedAt?: (id: string) => Promise<string | null> | string | null;
  findExistingTemplateCreatedAt?: (id: string) => Promise<string | null> | string | null;
}

export interface ServiceDeps {
  /** 默认使用 fs.promises.readFile */
  readFile?: (absPath: string) => Promise<string>;
  /** 默认 Date.now 取毫秒；用于回填 createdAt/updatedAt */
  now?: () => number;
  /** 默认 LOADER_SAFETY；与 loader 共用。 */
  loadSafety?: LoadOptions['safety'];
  /** lstat 注入，便于测试不存在的路径 */
  stat?: (absPath: string) => Promise<{ isDirectory(): boolean } | null>;
}

export interface ImportPathResult {
  taskCount: number;
  templateCount: number;
  issues: ValidationIssue[];
}

export interface ExportFileResult {
  yaml: string;
}

export interface WatchHandle {
  initialFileCount: number;
  stop: () => Promise<void>;
}

export interface AffectedEvent {
  at: number;
  tasks: string[];
  templates: string[];
  removedPaths: string[];
}

const DEFAULTS: Required<Pick<ServiceDeps, 'readFile' | 'now' | 'stat'>> = {
  readFile: (p) => fsp.readFile(p, 'utf8'),
  now: () => Date.now(),
  stat: async (p) => {
    try { return await fsp.lstat(p); } catch { return null; }
  },
};

export class TaskAsCodeService {
  private readonly readFile: NonNullable<ServiceDeps['readFile']>;
  private readonly now: NonNullable<ServiceDeps['now']>;
  private readonly stat: NonNullable<ServiceDeps['stat']>;
  private readonly loadSafety: LoadOptions['safety'];

  constructor(
    private readonly persistence: Persistence,
    deps: ServiceDeps = {},
  ) {
    this.readFile = deps.readFile ?? DEFAULTS.readFile;
    this.now = deps.now ?? DEFAULTS.now;
    this.stat = deps.stat ?? DEFAULTS.stat;
    this.loadSafety = deps.loadSafety;
  }

  /** 导入单个文件或目录到持久层。幂等：如 Persistence 提供 find* 钩子，同 id 二次导入保留原 createdAt。 */
  async importPath(target: string): Promise<ImportPathResult> {
    const st = await this.stat(target);
    if (!st) {
      return { taskCount: 0, templateCount: 0, issues: [issue(target, 'path does not exist')] };
    }
    const registry = st.isDirectory()
      ? await loadDirectory(target, { readFile: this.readFile, safety: this.loadSafety })
      : await this.loadSingleFileAsRegistry(target);
    const refIssues = resolveReferences(registry).issues;
    const nowIso = new Date(this.now()).toISOString();
    let taskCount = 0;
    let templateCount = 0;
    for (const entry of registry.tasks.values()) {
      const ts = await this.timestampsFor('task', entry.file.metadata.id, nowIso);
      await this.persistence.upsertTask(taskFromFile(entry.file, ts));
      taskCount++;
    }
    for (const entry of registry.templates.values()) {
      const ts = await this.timestampsFor('template', entry.file.metadata.id, nowIso);
      await this.persistence.upsertTemplate(templateFromFile(entry.file, ts));
      templateCount++;
    }
    return { taskCount, templateCount, issues: [...registry.issues, ...refIssues] };
  }

  private async timestampsFor(
    kind: 'task' | 'template',
    id: string,
    nowIso: string,
  ): Promise<FromFileTimestamps> {
    const existingCreatedAt = await this.lookupExistingCreatedAt(kind, id);
    // 显式判定：钩子返回 null / undefined / 空字符串均视为「无既存记录」。
    // 接口契约：`findExisting*CreatedAt` 应返回非空 ISO 字符串或 null/undefined。
    if (existingCreatedAt == null || existingCreatedAt === '') {
      return { now: nowIso };
    }
    return { now: nowIso, existingCreatedAt };
  }

  private async lookupExistingCreatedAt(
    kind: 'task' | 'template',
    id: string,
  ): Promise<string | null> {
    const fn = kind === 'task'
      ? this.persistence.findExistingTaskCreatedAt
      : this.persistence.findExistingTemplateCreatedAt;
    if (!fn) return null;
    try {
      return (await fn(id)) ?? null;
    } catch {
      return null;
    }
  }

  /** 把运行时 TaskFlow 映射为 YAML 文本。 */
  exportTask(task: TaskFlow): ExportFileResult {
    return { yaml: serializeFile(taskToFile(task)) };
  }

  /** 把运行时 ExtractionTemplate 映射为 YAML 文本。 */
  exportTemplate(template: ExtractionTemplate): ExportFileResult {
    return { yaml: serializeFile(templateToFile(template)) };
  }

  /**
   * 监听目录；变更时回调中带「受影响的 id 集合」与「移除的文件相对路径」。
   * 调用方据此决定是否重新 importPath() 或调用自己的 delete 逻辑。
   */
  async watchDirectory(
    rootDir: string,
    onAffected: (event: AffectedEvent) => void,
    options: Omit<WatcherOptions, 'now'> = {},
  ): Promise<WatchHandle> {
    const w: Watcher = createWatcher(rootDir, { ...options, now: this.now });
    w.onChange((evt) => {
      void this.classifyEvent(rootDir, evt).then(onAffected).catch(() => undefined);
    });
    const r = await w.start();
    return { initialFileCount: r.initialFileCount, stop: () => w.stop() };
  }

  // ──────────────────────────── internals ────────────────────────────

  private async parseSingleFile(absPath: string): Promise<{ file: AnyFile | null; issues: ValidationIssue[] }> {
    let text: string;
    try {
      text = await this.readFile(absPath);
    } catch (e) {
      return { file: null, issues: [issue(absPath, errMsg(e))] };
    }
    try {
      const result = parseFileMigrating(text, { filePath: absPath });
      return { file: result.file, issues: [] };
    } catch (e) {
      return { file: null, issues: [issue(absPath, errMsg(e))] };
    }
  }

  private async loadSingleFileAsRegistry(absPath: string): Promise<Registry> {
    const tasks: Registry['tasks'] = new Map();
    const templates: Registry['templates'] = new Map();
    const { file, issues } = await this.parseSingleFile(absPath);
    if (!file) return { tasks, templates, issues };
    if (file.kind === 'Task') {
      tasks.set(file.metadata.id, { file, absolutePath: absPath, displayPath: absPath });
    } else if (file.kind === 'Template') {
      templates.set(file.metadata.id, { file, absolutePath: absPath, displayPath: absPath });
    }
    return { tasks, templates, issues: [] };
  }

  private async classifyEvent(rootDir: string, evt: WatchEvent): Promise<AffectedEvent> {
    const out: AffectedEvent = { at: evt.at, tasks: [], templates: [], removedPaths: [] };
    for (const change of evt.changes) {
      if (change.kind === 'removed') {
        out.removedPaths.push(change.relativePath);
        continue;
      }
      const reg = await this.loadSingleFileAsRegistry(pathResolve(rootDir, change.relativePath));
      for (const id of reg.tasks.keys()) out.tasks.push(id);
      for (const id of reg.templates.keys()) out.templates.push(id);
    }
    return out;
  }
}

// ──────────────────────────── helpers ────────────────────────────

function issue(path: string, message: string): ValidationIssue {
  return { path, message, severity: 'error' };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export { LOADER_SAFETY };
