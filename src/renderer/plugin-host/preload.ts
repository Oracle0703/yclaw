import { contextBridge, ipcRenderer } from 'electron';

type PluginStorageValue = string | number | boolean | null | Record<string, unknown> | unknown[];

const allowedInvokeChannels = new Set([
  'plugin:manifest',
  'plugin:storage:get',
  'plugin:storage:set',
]);

function invokePluginChannel<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  if (!allowedInvokeChannels.has(channel)) {
    return Promise.reject(new Error(`Plugin channel "${channel}" is not allowed`));
  }
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

contextBridge.exposeInMainWorld('yclawPlugin', {
  getManifest: () => invokePluginChannel('plugin:manifest'),
  storage: {
    get: (key: string) => invokePluginChannel('plugin:storage:get', key),
    set: (key: string, value: PluginStorageValue) =>
      invokePluginChannel('plugin:storage:set', key, value),
  },
  log: {
    info: (message: string) => ipcRenderer.send('log:write', {
      level: 'info',
      source: 'plugin',
      message,
    }),
    warn: (message: string) => ipcRenderer.send('log:write', {
      level: 'warn',
      source: 'plugin',
      message,
    }),
    error: (message: string) => ipcRenderer.send('log:write', {
      level: 'error',
      source: 'plugin',
      message,
    }),
  },
});
