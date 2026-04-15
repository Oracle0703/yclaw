/**
 * IPC 消息类型定义
 */
import type {
  ExtractionResult,
  ExtractionTemplate,
  ScheduleConfig,
  TaskBatch,
  TaskBreakpoint,
} from './task';
import type { InterventionState, BrowserSession } from './browser';

/** IPC 请求/响应的基础格式 */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
}

/** 窗口打开参数 */
export interface WindowOpenParams {
  module: string;
  options?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
}

/** 日志写入参数 */
export interface LogWriteParams {
  level: 'debug' | 'info' | 'warn' | 'error';
  source: 'main' | 'renderer' | 'plugin' | 'engine';
  message: string;
  data?: unknown;
}

export interface TaskUpsertPayload {
  id?: string;
  name: string;
  description?: string;
  entryUrl?: string;
  schedule?: ScheduleConfig | null;
  templateId?: string | null;
  sessionId?: string | null;
}

export interface BatchQueryPayload {
  taskId: string;
}

export interface BatchDetailPayload {
  batchId: string;
}

export interface ResultExportPayload {
  taskId?: string;
  batchId?: string;
  format: 'csv' | 'json';
}

export interface SessionBindPayload {
  taskId: string;
  sessionId: string;
}

export interface TemplateSavePayload {
  id?: string;
  name: string;
  fields: ExtractionTemplate['fields'];
}

export interface TaskDetailResponse {
  taskId: string;
  latestBatch?: TaskBatch | null;
  breakpoint?: TaskBreakpoint | null;
}

export interface SchedulerStatusResponse {
  runningCount: number;
  queuedCount: number;
}

export interface ResultExportResponse {
  path: string;
}

export interface AlertRecord {
  id: string;
  taskId: string;
  batchId?: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AutomationBrowserOpsPayloadMap {
  task: TaskUpsertPayload;
  batch: TaskBatch;
  result: ExtractionResult;
  session: BrowserSession;
  intervention: InterventionState;
}

/** electronAPI 暴露到渲染进程的接口 */
export interface ElectronAPI {
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<IpcResponse<T>>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
