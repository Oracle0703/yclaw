import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../../shared/types';
import { createTaskAsCodeApi, type TaskAsCodeApi } from '../../renderer/shared/api/taskAsCode';
import { createRemoteRunnerApi } from '../../renderer/shared/api/remoteRunner';
import { createRunnerSchedulerApi } from '../../renderer/shared/api/runnerScheduler';
import { createDataCenterApi } from '../../renderer/shared/api/dataCenter';

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
