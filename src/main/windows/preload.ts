import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@shared/types';
import { createTaskAsCodeApi, type TaskAsCodeApi } from '@renderer/shared/api/taskAsCode';

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

const api: { taskAsCode: TaskAsCodeApi } = {
  taskAsCode: createTaskAsCodeApi({
    invoke: electronAPI.invoke,
    on: electronAPI.on,
  }),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('api', api);
