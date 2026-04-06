/**
 * 插件 API 桥接层 — 受限 API 集
 * 插件通过此桥接层与宿主通信
 */
export interface PluginAPI {
  /** 获取插件元信息 */
  getManifest: () => Promise<unknown>;
  /** 存储读写（仅插件专属空间） */
  storage: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  /** 日志 */
  log: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
}

// 初始化桥接
function initPluginBridge(): void {
  const api: PluginAPI = {
    getManifest: async () => {
      return window.electronAPI.invoke('plugin:manifest');
    },
    storage: {
      get: async (key: string) => {
        const res = await window.electronAPI.invoke('plugin:storage:get', key);
        return res;
      },
      set: async (key: string, value: unknown) => {
        await window.electronAPI.invoke('plugin:storage:set', key, value);
      },
    },
    log: {
      info: (message: string) => console.log(`[Plugin] ${message}`),
      warn: (message: string) => console.warn(`[Plugin] ${message}`),
      error: (message: string) => console.error(`[Plugin] ${message}`),
    },
  };

  // 暴露给插件的全局 API
  (window as unknown as Record<string, unknown>).yclawPlugin = api;
}

initPluginBridge();
