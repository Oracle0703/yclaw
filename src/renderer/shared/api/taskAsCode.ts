/**
 * Task-as-Code 渲染端 API — 纯逻辑工厂，方便单测。
 *
 * 入参：`invoke`（透传 IPC 调用，返回 `IpcResponse<T>`）、`on`（监听推送，返回 unsubscribe）。
 * 出参：`{ importYaml, exportYaml, watchStart, watchStop, onWatchEvent }`，全部 typed。
 *
 * 错误处理：所有 invoke 调用统一 unwrap `IpcResponse`，失败时抛出包含 `code`/`message` 的 Error。
 */

import type { IpcResponse, TaskFlow, ExtractionTemplate } from '@shared/types';
import { TAC_CHANNELS, type WatchEventEnvelope } from '@shared/constants/task-as-code';

export interface TaskAsCodeInvoker {
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<IpcResponse<T>>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

export interface ImportPathResultLike {
  taskCount: number;
  templateCount: number;
  issues: ReadonlyArray<{ filePath?: string; message: string }>;
}

export interface WatchStartResult { watchId: string; initialFileCount: number }
export interface WatchStopResult { stopped: boolean }
export type ExportKind = 'task' | 'template';
export type ExportPayload<K extends ExportKind> = K extends 'task' ? TaskFlow : ExtractionTemplate;

export interface TaskAsCodeApi {
  importYaml(path: string): Promise<ImportPathResultLike>;
  exportYaml<K extends ExportKind>(kind: K, payload: ExportPayload<K>): Promise<{ yaml: string }>;
  watchStart(rootDir: string, debounceMs?: number): Promise<WatchStartResult>;
  watchStop(watchId: string): Promise<WatchStopResult>;
  /** 监听 watch 事件；返回取消订阅函数。 */
  onWatchEvent(callback: (envelope: WatchEventEnvelope) => void): () => void;
}

export function createTaskAsCodeApi(deps: TaskAsCodeInvoker): TaskAsCodeApi {
  return {
    importYaml: (path) => unwrap(deps.invoke<ImportPathResultLike>(TAC_CHANNELS.importYaml, { path })),
    exportYaml: (kind, payload) =>
      unwrap(deps.invoke<{ yaml: string }>(TAC_CHANNELS.exportYaml, { kind, payload })),
    watchStart: (rootDir, debounceMs) => {
      const payload = debounceMs === undefined ? { rootDir } : { rootDir, debounceMs };
      return unwrap(deps.invoke<WatchStartResult>(TAC_CHANNELS.watchStart, payload));
    },
    watchStop: (watchId) => unwrap(deps.invoke<WatchStopResult>(TAC_CHANNELS.watchStop, { watchId })),
    onWatchEvent: (callback) =>
      deps.on(TAC_CHANNELS.watchEvent, (...args: unknown[]) => {
        const env = args[0];
        if (isWatchEnvelope(env)) callback(env);
      }),
  };
}

/** 校验 main → renderer 推送的 envelope；防御性保护（preload 端不可信任 args 形态）。 */
export function isWatchEnvelope(value: unknown): value is WatchEventEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.watchId === 'string' && typeof v.event === 'object' && v.event !== null;
}

async function unwrap<T>(p: Promise<IpcResponse<T>>): Promise<T> {
  const res = await p;
  if (res.success) return res.data as T;
  const code = res.error?.code;
  const hasCode = typeof code === 'string' && code.length > 0;
  const message = res.error?.message
    ?? (hasCode ? `IPC call failed (${code})` : 'IPC call failed');
  const err = new Error(message) as Error & { code?: string };
  if (hasCode) err.code = code;
  throw err;
}

declare global {
  interface Window {
    api: { taskAsCode: TaskAsCodeApi };
  }
}
