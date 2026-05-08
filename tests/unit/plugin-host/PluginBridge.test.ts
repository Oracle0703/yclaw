// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

declare global {
  interface Window {
    yclawPlugin?: {
      log: {
        info: (message: string) => void;
        warn: (message: string) => void;
        error: (message: string) => void;
      };
    };
    electronAPI: {
      invoke: ReturnType<typeof vi.fn>;
    };
  }
}

describe('PluginBridge', () => {
  beforeEach(() => {
    vi.resetModules();
    window.electronAPI = {
      invoke: vi.fn().mockResolvedValue(undefined),
    };
    delete window.yclawPlugin;
  });

  it('routes plugin logs to the main log channel', async () => {
    await import('@renderer/plugin-host/PluginBridge');

    window.yclawPlugin?.log.error('plugin failed');

    expect(window.electronAPI.invoke).toHaveBeenCalledWith('log:write', {
      level: 'error',
      source: 'plugin',
      message: 'plugin failed',
    });
  });
});
