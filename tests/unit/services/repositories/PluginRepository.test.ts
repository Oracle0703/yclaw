import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginRepository } from '@main/services/repositories/PluginRepository';

describe('PluginRepository', () => {
  let all: ReturnType<typeof vi.fn>;
  let repository: PluginRepository;

  beforeEach(() => {
    all = vi.fn();
    repository = new PluginRepository({ all });
  });

  it('maps installed plugin status to enabled flag', () => {
    all.mockReturnValue([
      { name: 'alpha', version: '1.0.0', status: 'active' },
      { name: 'beta', version: '1.1.0', status: 'installed' },
    ]);

    expect(repository.getInstalledPlugins()).toEqual([
      { name: 'alpha', version: '1.0.0', enabled: true },
      { name: 'beta', version: '1.1.0', enabled: false },
    ]);
    expect(all).toHaveBeenCalledWith(expect.stringContaining('FROM plugins'));
  });
});
