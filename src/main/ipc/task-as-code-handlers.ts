/**
 * Task-as-Code IPC handlers — 纯 Node、可单测。
 *
 * 设计：
 * - 不直接依赖 Electron；通过 `IpcLikeController` 注册 channel，便于 mock。
 * - `task:watch:start` 维护 watchId → handle，事件经注入的 `emit` 推送出去。
 * - 所有 handler 返回普通对象，由 IpcController 自身负责 success/error 包装。
 */

import { randomUUID } from 'node:crypto';
import type {
  TaskAsCodeService,
  AffectedEvent,
} from '@shared/serialization/service';
import type { TaskFlow, ExtractionTemplate } from '@shared/types/task';

export const TAC_CHANNELS = {
  importYaml: 'task:importYaml',
  exportYaml: 'task:exportYaml',
  watchStart: 'task:watch:start',
  watchStop: 'task:watch:stop',
  watchEvent: 'task:watch:event',
} as const;

export type TacChannel = (typeof TAC_CHANNELS)[keyof typeof TAC_CHANNELS];

export interface IpcLikeController {
  handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown> | unknown) => void;
  removeHandler?: (channel: string) => void;
}

export interface WatchEventEnvelope {
  watchId: string;
  event: AffectedEvent;
}

export interface TaskAsCodeHandlersDeps {
  service: TaskAsCodeService;
  /** 把 watch 事件推送给渲染进程；测试可注入 spy。 */
  emit: (channel: typeof TAC_CHANNELS.watchEvent, payload: WatchEventEnvelope) => void;
  /** 默认使用 randomUUID；测试可注入确定性 id。 */
  generateId?: () => string;
}

export interface ImportYamlPayload { path: unknown }
export interface ExportYamlPayload { kind: unknown; payload: unknown }
export interface WatchStartPayload { rootDir: unknown; debounceMs?: unknown }
export interface WatchStopPayload { watchId: unknown }

/** 创建 handler 集合（不注册）。便于直接单测每个 handler。 */
export function createTaskAsCodeHandlers(deps: TaskAsCodeHandlersDeps) {
  const { service, emit } = deps;
  const generateId = deps.generateId ?? (() => randomUUID());
  const watches = new Map<string, { stop: () => Promise<void> }>();

  async function importYaml(payload: unknown) {
    const path = readString((payload as ImportYamlPayload | undefined)?.path, 'path');
    return service.importPath(path);
  }

  async function exportYaml(payload: unknown) {
    const p = (payload ?? {}) as ExportYamlPayload;
    const kind = readString(p.kind, 'kind');
    if (kind === 'task') {
      return service.exportTask(p.payload as TaskFlow);
    }
    if (kind === 'template') {
      return service.exportTemplate(p.payload as ExtractionTemplate);
    }
    throw new Error(`Unknown kind: ${String(kind)}`);
  }

  async function watchStart(payload: unknown) {
    const p = (payload ?? {}) as WatchStartPayload;
    const rootDir = readString(p.rootDir, 'rootDir');
    const debounceMs = typeof p.debounceMs === 'number' ? p.debounceMs : undefined;
    const watchId = generateId();
    const handle = await service.watchDirectory(
      rootDir,
      (event) => emit(TAC_CHANNELS.watchEvent, { watchId, event }),
      debounceMs !== undefined ? { debounceMs } : {},
    );
    watches.set(watchId, { stop: handle.stop });
    return { watchId, initialFileCount: handle.initialFileCount };
  }

  async function watchStop(payload: unknown) {
    const watchId = readString((payload as WatchStopPayload | undefined)?.watchId, 'watchId');
    const entry = watches.get(watchId);
    if (!entry) return { stopped: false };
    await entry.stop();
    watches.delete(watchId);
    return { stopped: true };
  }

  async function disposeAll() {
    const all = Array.from(watches.values());
    watches.clear();
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
