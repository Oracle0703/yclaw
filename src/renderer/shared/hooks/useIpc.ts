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

  return { invoke };
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
