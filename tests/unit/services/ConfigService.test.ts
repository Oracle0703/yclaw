import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock paths
const testDir = path.join(os.tmpdir(), 'yclaw-test-config-' + Date.now());
vi.mock('@main/utils/paths', () => ({
  getConfigPath: () => testDir,
}));

// Mock EventBus
vi.mock('@main/ipc/EventBus', () => {
  const emitFn = vi.fn();
  return {
    EventBus: {
      getInstance: () => ({
        emit: emitFn,
        on: vi.fn(),
        off: vi.fn(),
      }),
      _emit: emitFn,
    },
  };
});

import { ConfigService } from '@main/services/ConfigService';
import { EventBus } from '@main/ipc/EventBus';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    service = new ConfigService();
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should return default config on first run', () => {
    const config = service.getAll();
    expect(config.general.theme).toBe('system');
    expect(config.general.language).toBe('zh-CN');
    expect(config.general.startupBehavior).toBe('showWorkbench');
    expect(config.general.closeToTray).toBe(false);
  });

  it('should get a specific section', () => {
    const general = service.get('general');
    expect(general.theme).toBe('system');
  });

  it('should set a section and persist', () => {
    service.set('general', {
      theme: 'dark',
      language: 'en-US',
      startupBehavior: 'showWorkbench',
      closeToTray: true,
    });
    const general = service.get('general');
    expect(general.theme).toBe('dark');
    expect(general.closeToTray).toBe(true);

    // Verify persisted to file
    const filePath = path.join(testDir, 'settings.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(raw.general.theme).toBe('dark');
  });

  it('should emit CONFIG_CHANGED event on set', () => {
    const bus = EventBus.getInstance();
    service.set('general', {
      theme: 'light',
      language: 'zh-CN',
      startupBehavior: 'showWorkbench',
      closeToTray: false,
    });
    expect(bus.emit).toHaveBeenCalled();
  });

  it('should partially update general config', () => {
    service.setGeneral({ theme: 'dark' });
    const general = service.getGeneral();
    expect(general.theme).toBe('dark');
    expect(general.language).toBe('zh-CN'); // kept default
  });

  it('should reset to defaults', () => {
    service.setGeneral({ theme: 'dark', language: 'en-US' });
    service.reset();
    const general = service.getGeneral();
    expect(general.theme).toBe('system');
    expect(general.language).toBe('zh-CN');
  });

  it('should export config as JSON string', () => {
    const exported = service.exportConfig();
    const parsed = JSON.parse(exported);
    expect(parsed.general).toBeDefined();
    expect(parsed.general.theme).toBe('system');
  });

  it('should import config from JSON string', () => {
    const importData = JSON.stringify({
      general: {
        theme: 'dark',
        language: 'ja-JP',
        startupBehavior: 'showWorkbench',
        closeToTray: true,
      },
    });
    service.importConfig(importData);
    const general = service.getGeneral();
    expect(general.theme).toBe('dark');
    expect(general.language).toBe('ja-JP');
  });

  it('should use defaults for missing fields on import', () => {
    service.importConfig('{}');
    const config = service.getAll();
    expect(config.general.theme).toBe('system');
  });

  it('should throw on invalid JSON import', () => {
    expect(() => service.importConfig('not json')).toThrow();
  });

  it('should survive corrupt config file', () => {
    const filePath = path.join(testDir, 'settings.json');
    fs.writeFileSync(filePath, 'corrupt{{{', 'utf-8');
    const newService = new ConfigService();
    expect(newService.getAll().general.theme).toBe('system');
  });
});
