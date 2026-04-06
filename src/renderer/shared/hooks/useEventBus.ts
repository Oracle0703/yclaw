import { useIpcEvent } from './useIpc';
import { EVENTS } from '@shared/constants';

/**
 * 事件总线 Hook — 监听全局事件
 */
export function useEventBus(event: string, callback: (...args: unknown[]) => void) {
  useIpcEvent(event, callback);
}

export function useConfigChanged(callback: (change: { key: string; value: unknown }) => void) {
  useEventBus(EVENTS.CONFIG_CHANGED, (data) => callback(data as { key: string; value: unknown }));
}

export function useTaskEvent(
  event: 'started' | 'completed' | 'failed' | 'paused',
  callback: (data: unknown) => void,
) {
  const eventName =
    event === 'started'
      ? EVENTS.TASK_STARTED
      : event === 'completed'
        ? EVENTS.TASK_COMPLETED
        : event === 'failed'
          ? EVENTS.TASK_FAILED
          : EVENTS.TASK_PAUSED;
  useEventBus(eventName, callback);
}
