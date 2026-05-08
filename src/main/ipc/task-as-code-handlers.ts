/**
 * Task-as-Code IPC handlers — 纯 Node、可单测。
 *
 * 设计：
 * - 不直接依赖 Electron；通过 `IpcLikeController` 注册 channel，便于 mock。
 * - `task:watch:start` 维护 watchId → handle，事件经注入的 `emit` 推送出去。
 * - 所有 handler 返回普通对象，由 IpcController 自身负责 success/error 包装。
 */

import { randomUUID } from 'node:crypto';
import type { TaskAsCodeService } from '@shared/serialization/service';
import type { TaskFlow, ExtractionTemplate } from '@shared/types/task';
import { TAC_CHANNELS, type TacChannel, type WatchEventEnvelope } from '@shared/constants/task-as-code';

export { TAC_CHANNELS, type TacChannel, type WatchEventEnvelope };

export interface IpcLikeController {
  handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown> | unknown) => void;
  removeHandler?: (channel: string) => void;
}

export interface TaskAsCodeHandlersDeps {
  service: TaskAsCodeService;
  /** 把 watch 事件推送给渲染进程；测试可注入 spy。 */
  emit: (channel: typeof TAC_CHANNELS.watchEvent, payload: WatchEventEnvelope) => void;
  /** 默认使用 randomUUID；测试可注入确定性 id。 */
  generateId?: () => string;
  /** watcher 上限，超出后 watchStart 抛错；默认 32，0 = 不限制。 */
  maxWatches?: number;
  /** watcher 自动释放 TTL（ms）；默认 24h，0 = 永不过期。 */
  watchTtlMs?: number;
  /** 注入定时器（便于测试）。 */
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface ImportYamlPayload { path: unknown }
export interface ExportYamlPayload { kind: unknown; payload: unknown }
export interface WatchStartPayload { rootDir: unknown; debounceMs?: unknown }
export interface WatchStopPayload { watchId: unknown }

/** 创建 handler 集合（不注册）。便于直接单测每个 handler。 */
export function createTaskAsCodeHandlers(deps: TaskAsCodeHandlersDeps) {
  const { service, emit } = deps;
  const generateId = deps.generateId ?? (() => randomUUID());
  const maxWatches = deps.maxWatches ?? 32;
  const watchTtlMs = deps.watchTtlMs ?? 24 * 60 * 60 * 1000;
  const setTimer = deps.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const watches = new Map<string, { stop: () => Promise<void>; ttl: unknown }>();

  async function importYaml(payload: unknown) {
    const path = readString((payload as ImportYamlPayload | undefined)?.path, 'path');
    return service.importPath(path);
  }

  async function exportYaml(payload: unknown) {
    const p = (payload ?? {}) as ExportYamlPayload;
    const kind = readString(p.kind, 'kind');
    if (kind === 'task') {
      return service.exportTask(assertTaskFlow(p.payload));
    }
    if (kind === 'template') {
      return service.exportTemplate(assertExtractionTemplate(p.payload));
    }
    throw new Error(`Unknown kind: ${String(kind)}`);
  }

  async function watchStart(payload: unknown) {
    const p = (payload ?? {}) as WatchStartPayload;
    const rootDir = readString(p.rootDir, 'rootDir');
    const debounceMs = typeof p.debounceMs === 'number' ? p.debounceMs : undefined;
    if (maxWatches > 0 && watches.size >= maxWatches) {
      throw new Error(`Watch limit reached (max=${maxWatches})`);
    }
    const watchId = generateId();
    const handle = await service.watchDirectory(
      rootDir,
      (event) => emit(TAC_CHANNELS.watchEvent, { watchId, event }),
      debounceMs !== undefined ? { debounceMs } : {},
    );
    const ttl = watchTtlMs > 0
      ? setTimer(() => { void autoStop(watchId); }, watchTtlMs)
      : null;
    watches.set(watchId, { stop: handle.stop, ttl });
    return { watchId, initialFileCount: handle.initialFileCount };
  }

  async function autoStop(watchId: string) {
    const entry = watches.get(watchId);
    if (!entry) return;
    watches.delete(watchId);
    try { await entry.stop(); } catch { /* swallow: TTL cleanup best-effort */ }
  }

  async function watchStop(payload: unknown) {
    const watchId = readString((payload as WatchStopPayload | undefined)?.watchId, 'watchId');
    const entry = watches.get(watchId);
    if (!entry) return { stopped: false };
    if (entry.ttl != null) clearTimer(entry.ttl);
    await entry.stop();
    watches.delete(watchId);
    return { stopped: true };
  }

  async function disposeAll() {
    const all = Array.from(watches.values());
    watches.clear();
    for (const w of all) {
      if (w.ttl != null) clearTimer(w.ttl);
    }
    await Promise.allSettled(all.map((w) => w.stop()));
  }

  return {
    importYaml,
    exportYaml,
    watchStart,
    watchStop,
    disposeAll,
    /** 只读快照，便于断言/排错；不要直接修改。 */
    listWatchIds: () => Array.from(watches.keys()),
    get watchCount() { return watches.size; },
  };
}

export type TaskAsCodeHandlers = ReturnType<typeof createTaskAsCodeHandlers>;

/** 把 handlers 注册到 IpcController-like 对象上。 */
export function registerTaskAsCodeHandlers(
  controller: IpcLikeController,
  handlers: TaskAsCodeHandlers,
): void {
  controller.handle(TAC_CHANNELS.importYaml, (payload) => handlers.importYaml(payload));
  controller.handle(TAC_CHANNELS.exportYaml, (payload) => handlers.exportYaml(payload));
  controller.handle(TAC_CHANNELS.watchStart, (payload) => handlers.watchStart(payload));
  controller.handle(TAC_CHANNELS.watchStop, (payload) => handlers.watchStop(payload));
}

// ──────────────────────────── helpers ────────────────────────────

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid payload: "${field}" must be a non-empty string`);
  }
  return value;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireNonEmptyString(host: Record<string, unknown>, key: string, label: string): void {
  if (typeof host[key] !== 'string' || (host[key] as string).length === 0) {
    throw new Error(`Invalid payload: ${label}.${key} must be a non-empty string`);
  }
}

function requireString(host: Record<string, unknown>, key: string, label: string): void {
  if (typeof host[key] !== 'string') {
    throw new Error(`Invalid payload: ${label}.${key} must be a string`);
  }
}

function requireArray(host: Record<string, unknown>, key: string, label: string): unknown[] {
  if (!Array.isArray(host[key])) {
    throw new Error(`Invalid payload: ${label}.${key} must be an array`);
  }
  return host[key] as unknown[];
}

/**
 * IPC 边界检查：仅校验 TaskFlow 的必填字段与粗粒度形状，其余字段由
 * 下游 `taskToFile` -> `validateFile` 担保。保证"不合法负载在调用 service 前被拒绝"。
 */
export function assertTaskFlow(value: unknown): TaskFlow {
  if (!isObject(value)) throw new Error('Invalid payload: TaskFlow must be an object');
  requireNonEmptyString(value, 'id', 'TaskFlow');
  requireString(value, 'name', 'TaskFlow');
  const steps = requireArray(value, 'steps', 'TaskFlow');
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!isObject(s) || typeof s.id !== 'string' || typeof s.name !== 'string' || !isObject(s.action)) {
      throw new Error(`Invalid payload: TaskFlow.steps[${i}] must be { id, name, action }`);
    }
  }
  return value as unknown as TaskFlow;
}

export function assertExtractionTemplate(value: unknown): ExtractionTemplate {
  if (!isObject(value)) throw new Error('Invalid payload: ExtractionTemplate must be an object');
  requireNonEmptyString(value, 'id', 'ExtractionTemplate');
  requireString(value, 'name', 'ExtractionTemplate');
  const fields = requireArray(value, 'fields', 'ExtractionTemplate');
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!isObject(f) || typeof f.name !== 'string' || typeof f.selector !== 'string' || typeof f.attribute !== 'string') {
      throw new Error(`Invalid payload: ExtractionTemplate.fields[${i}] must be { name, selector, attribute }`);
    }
  }
  return value as unknown as ExtractionTemplate;
}
