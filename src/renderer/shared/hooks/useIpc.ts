import { useCallback, useEffect, useRef } from 'react';
import type { IpcResponse } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';

/**
 * IPC 调用 Hook — 渲染进程调用主进程的统一接口
 */
export function useIpc() {
  const invoke = useCallback(
    async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
      const response: IpcResponse<T> = await window.electronAPI.invoke(channel, ...args);
      if (!response.success) {
        throw new Error(response.error?.message ?? 'IPC call failed');
      }
      return response.data as T;
    },
    [],
  );

  const automation = {
    listTasks: () => invoke(IPC_CHANNELS.TASK_LIST),
    startTask: (taskId: string) => invoke(IPC_CHANNELS.TASK_START, { taskId }),
    retryBatch: (batchId: string) => invoke(IPC_CHANNELS.BATCH_RETRY, { batchId }),
    listBatches: (taskId: string) => invoke(IPC_CHANNELS.TASK_BATCH_LIST, { taskId }),
    listResults: (taskId: string, batchId?: string) =>
      invoke(IPC_CHANNELS.RESULT_LIST, { taskId, batchId }),
    exportResults: (taskId: string, batchId: string | undefined, format: 'csv' | 'json') =>
      invoke(IPC_CHANNELS.RESULT_EXPORT, { taskId, batchId, format }),
    listTemplates: () => invoke(IPC_CHANNELS.TEMPLATE_LIST),
    saveTemplate: (name: string, fields: unknown[]) =>
      invoke(IPC_CHANNELS.TEMPLATE_SAVE, { name, fields }),
    deleteTemplate: (templateId: string) => invoke(IPC_CHANNELS.TEMPLATE_DELETE, { templateId }),
    startRecorder: (tabId: number) => invoke(IPC_CHANNELS.RECORDER_START, { tabId }),
    stopRecorder: (tabId: number) => invoke(IPC_CHANNELS.RECORDER_STOP, { tabId }),
    listAlerts: (taskId?: string) => invoke(IPC_CHANNELS.ALERT_LIST, { taskId }),
    dismissAlert: (alertId: string) => invoke(IPC_CHANNELS.ALERT_DISMISS, { alertId }),
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
