import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
  },
  mkdirSync: vi.fn(),
}));

vi.mock('@main/utils/paths', () => ({
  getPluginsPath: vi.fn(() => 'C:\\plugins'),
}));

import { PluginLoader } from '@main/plugin-loader/PluginLoader';

describe('PluginLoader', () => {
  const mockEventBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  const mockPermissionChecker = {
    validateManifest: vi.fn(() => ({ valid: true, violations: [] })),
    requiresUserConfirmation: vi.fn(() => false),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires event bus injection', () => {
    expect(() => new PluginLoader({ permissionChecker: mockPermissionChecker as never })).toThrowError(
      'eventBus is required',
    );
  });

  it('requires permission checker injection', () => {
    expect(() => new PluginLoader({ eventBus: mockEventBus as never })).toThrowError(
      'permissionChecker is required',
    );
  });

  it('constructs successfully with explicit event bus and permission checker', () => {
    expect(
      () =>
        new PluginLoader({
          eventBus: mockEventBus as never,
          permissionChecker: mockPermissionChecker as never,
        }),
    ).not.toThrow();
  });
});
