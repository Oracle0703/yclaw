import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../../shared/types';
import { EVENTS } from '../../shared/constants';
import { createTaskAsCodeApi, type TaskAsCodeApi } from '../../renderer/shared/api/taskAsCode';
import { createRemoteRunnerApi } from '../../renderer/shared/api/remoteRunner';
import { createRunnerSchedulerApi } from '../../renderer/shared/api/runnerScheduler';
import { createDataCenterApi } from '../../renderer/shared/api/dataCenter';

// 早期监听 APP_NAVIGATE：在 React 挂载之前主进程下发的 navigate 事件需要被 buffer 住，
// 等渲染端的 NavigationBridge 起来后通过 consumePendingNavigate() 消费一次。
// bridge 接管后不再 buffer，避免 hot-reload 重新 mount 时读到陈旧值覆盖用户当前路由。
let pendingNavigateModule: string | null = null;
let navigateBridgeReady = false;
ipcRenderer.on(EVENTS.APP_NAVIGATE, (_event, payload: { module?: string }) => {
  if (navigateBridgeReady) return;
  if (payload && typeof payload.module === 'string') {
    pendingNavigateModule = payload.module;
  }
});

const electronAPI: ElectronAPI = {
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

const api: {
  taskAsCode: TaskAsCodeApi;
  remoteRunner: ReturnType<typeof createRemoteRunnerApi>;
  runnerScheduler: ReturnType<typeof createRunnerSchedulerApi>;
  dataCenter: ReturnType<typeof createDataCenterApi>;
} = {
  taskAsCode: createTaskAsCodeApi({
    invoke: electronAPI.invoke,
    on: electronAPI.on,
  }),
  remoteRunner: createRemoteRunnerApi({ invoke: electronAPI.invoke }),
  runnerScheduler: createRunnerSchedulerApi({ invoke: electronAPI.invoke }),
  dataCenter: createDataCenterApi({ invoke: electronAPI.invoke, on: electronAPI.on }),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('__yclawNavigateBridge', {
  consumePendingNavigate(): string | null {
    navigateBridgeReady = true;
    const value = pendingNavigateModule;
    pendingNavigateModule = null;
    return value;
  },
});
