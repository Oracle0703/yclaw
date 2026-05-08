import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { PermissionLevel, PERMISSION_LEVEL_CAPABILITIES, PERMISSION_NAMES } from '@shared/constants/permissions';
import { EVENTS } from '@shared/constants/events';

describe('IPC_CHANNELS', () => {
  it('should define all window channels', () => {
    expect(IPC_CHANNELS.WINDOW_OPEN).toBe('window:open');
    expect(IPC_CHANNELS.WINDOW_CLOSE).toBe('window:close');
    expect(IPC_CHANNELS.WINDOW_MINIMIZE).toBe('window:minimize');
    expect(IPC_CHANNELS.WINDOW_MAXIMIZE).toBe('window:maximize');
    expect(IPC_CHANNELS.WINDOW_LIST).toBe('window:list');
  });

  it('should define all config channels', () => {
    expect(IPC_CHANNELS.CONFIG_GET).toBe('config:get');
    expect(IPC_CHANNELS.CONFIG_SET).toBe('config:set');
    expect(IPC_CHANNELS.CONFIG_GET_ALL).toBe('config:getAll');
    expect(IPC_CHANNELS.CONFIG_RESET).toBe('config:reset');
  });

  it('should define all task channels', () => {
    expect(IPC_CHANNELS.TASK_START).toBe('task:start');
    expect(IPC_CHANNELS.TASK_PAUSE).toBe('task:pause');
    expect(IPC_CHANNELS.TASK_RESUME).toBe('task:resume');
    expect(IPC_CHANNELS.TASK_STOP).toBe('task:stop');
  });

  it('should define all plugin channels', () => {
    expect(IPC_CHANNELS.PLUGIN_LIST).toBe('plugin:list');
    expect(IPC_CHANNELS.PLUGIN_INSTALL).toBe('plugin:install');
    expect(IPC_CHANNELS.PLUGIN_UNINSTALL).toBe('plugin:uninstall');
  });

  it('should define feature package channels', () => {
    expect(IPC_CHANNELS.FEATURE_PACKAGE_LIST).toBe('feature:list');
    expect(IPC_CHANNELS.FEATURE_PACKAGE_INSTALL).toBe('feature:install');
  });

  it('should follow naming convention {module}:{action}', () => {
    const allChannels = Object.values(IPC_CHANNELS);
    for (const channel of allChannels) {
      expect(channel).toMatch(/^[a-z]+:[a-z]+/);
    }
  });

  it('should have unique channel values', () => {
    const allChannels = Object.values(IPC_CHANNELS);
    const unique = new Set(allChannels);
    expect(unique.size).toBe(allChannels.length);
  });
});

describe('PermissionLevel', () => {
  it('should define three permission levels', () => {
    expect(PermissionLevel.UI_READONLY).toBe(1);
    expect(PermissionLevel.NETWORK_STORAGE).toBe(2);
    expect(PermissionLevel.AUTOMATION_FILESYSTEM).toBe(3);
  });
});

describe('PERMISSION_LEVEL_CAPABILITIES', () => {
  it('should give Level 1 only UI capabilities', () => {
    const caps = PERMISSION_LEVEL_CAPABILITIES[PermissionLevel.UI_READONLY];
    expect(caps).toContain('ui');
    expect(caps).toContain('state:read');
    expect(caps).not.toContain('network');
    expect(caps).not.toContain('filesystem');
  });

  it('should give Level 2 network and storage', () => {
    const caps = PERMISSION_LEVEL_CAPABILITIES[PermissionLevel.NETWORK_STORAGE];
    expect(caps).toContain('network');
    expect(caps).toContain('storage');
    expect(caps).not.toContain('filesystem');
    expect(caps).not.toContain('automation');
  });

  it('should give Level 3 all capabilities', () => {
    const caps = PERMISSION_LEVEL_CAPABILITIES[PermissionLevel.AUTOMATION_FILESYSTEM];
    expect(caps).toContain('ui');
    expect(caps).toContain('network');
    expect(caps).toContain('storage');
    expect(caps).toContain('filesystem');
    expect(caps).toContain('automation');
    expect(caps).toContain('webcontents');
  });

  it('should be a superset at each level', () => {
    const l1 = PERMISSION_LEVEL_CAPABILITIES[PermissionLevel.UI_READONLY];
    const l2 = PERMISSION_LEVEL_CAPABILITIES[PermissionLevel.NETWORK_STORAGE];
    const l3 = PERMISSION_LEVEL_CAPABILITIES[PermissionLevel.AUTOMATION_FILESYSTEM];
    // L2 should contain all of L1
    for (const cap of l1) {
      expect(l2).toContain(cap);
    }
    // L3 should contain all of L2
    for (const cap of l2) {
      expect(l3).toContain(cap);
    }
  });
});

describe('PERMISSION_NAMES', () => {
  it('should have human-readable names for all permissions', () => {
    expect(PERMISSION_NAMES.network).toBeDefined();
    expect(PERMISSION_NAMES.storage).toBeDefined();
    expect(PERMISSION_NAMES.filesystem).toBeDefined();
    expect(PERMISSION_NAMES.automation).toBeDefined();
  });
});

describe('EVENTS', () => {
  it('should define module events', () => {
    expect(EVENTS.MODULE_OPENED).toBe('module:opened');
    expect(EVENTS.MODULE_CLOSED).toBe('module:closed');
  });

  it('should define task events', () => {
    expect(EVENTS.TASK_STARTED).toBe('task:started');
    expect(EVENTS.TASK_COMPLETED).toBe('task:completed');
    expect(EVENTS.TASK_FAILED).toBe('task:failed');
    expect(EVENTS.TASK_PAUSED).toBe('task:paused');
    expect(EVENTS.TASK_STATUS_CHANGED).toBe('task:status:changed');
  });

  it('should define plugin events', () => {
    expect(EVENTS.PLUGIN_ACTIVATED).toBe('plugin:activated');
    expect(EVENTS.PLUGIN_DEACTIVATED).toBe('plugin:deactivated');
    expect(EVENTS.PLUGIN_INSTALLED).toBe('plugin:installed');
    expect(EVENTS.PLUGIN_UNINSTALLED).toBe('plugin:uninstalled');
  });

  it('should have unique event values', () => {
    const allEvents = Object.values(EVENTS);
    const unique = new Set(allEvents);
    expect(unique.size).toBe(allEvents.length);
  });
});
