/**
 * IPC 消息类型定义
 */

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
