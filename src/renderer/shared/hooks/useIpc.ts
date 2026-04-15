import { useCallback, useEffect, useRef } from 'react';
import type { IpcResponse } from '@shared/types';

/**
 * IPC 调用 Hook — 渲染进程调用主进程的统一接口
 */
export function useIpc() {
  const invoke = useCallback(async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    const response: IpcResponse<T> = await window.electronAPI.invoke(channel, ...args);
    if (!response.success) {
      throw new Error(response.error?.message ?? 'IPC call failed');
    }
    return response.data as T;
  }, []);

  const automation = {
    listTasks: () => invoke('task:list'),
    startTask: (taskId: string) => invoke('task:start', { taskId }),
    retryBatch: (batchId: string) => invoke('batch:retry', { batchId }),
    listBatches: (taskId: string) => invoke('batch:list', { taskId }),
    listResults: (taskId: string, batchId?: string) => invoke('result:list', { taskId, batchId }),
    exportResults: (taskId: string, batchId: string | undefined, format: 'csv' | 'json') =>
      invoke('result:export', { taskId, batchId, format }),
    listTemplates: () => invoke('template:list'),
    saveTemplate: (name: string, fields: unknown[]) => invoke('template:save', { name, fields }),
    deleteTemplate: (templateId: string) => invoke('template:delete', { templateId }),
    startRecorder: (tabId: number) => invoke('recorder:start', { tabId }),
    stopRecorder: (tabId: number) => invoke('recorder:stop', { tabId }),
    listAlerts: (taskId?: string) => invoke('alert:list', { taskId }),
    dismissAlert: (alertId: string) => invoke('alert:dismiss', { alertId }),
  };

  return { invoke, automation };
}

/**
 * IPC 事件监听 Hook
 */
export function useIpcEvent(channel: string, callback: (...args: unknown[]) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = window.electronAPI.on(channel, (...args: unknown[]) => {
      callbackRef.current(...args);
    });
    return unsubscribe;
  }, [channel]);
}
