import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LogService } from '@main/services/LogService';

// Must use vi.hoisted for variables referenced in vi.mock factories
const { mockAutoUpdater } = vi.hoisted(() => ({
  mockAutoUpdater: {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue({}),
    downloadUpdate: vi.fn().mockResolvedValue({}),
    quitAndInstall: vi.fn(),
  },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

// Mock LogService
const mockLogService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  write: vi.fn(),
  close: vi.fn(),
  exportDebugPackage: vi.fn(),
};

import { UpdateService } from '@main/services/UpdateService';

describe('UpdateService', () => {
  let service: UpdateService;
  const mockEventBus = {
    emit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UpdateService({
      logService: mockLogService as unknown as LogService,
      eventBus: mockEventBus,
    });
  });

  describe('constructor', () => {
    it('requires log service injection', () => {
      expect(() => new UpdateService({ eventBus: mockEventBus })).toThrowError(
        'logService is required',
      );
    });

    it('requires event bus injection', () => {
      expect(() =>
        new UpdateService({
          logService: mockLogService as unknown as LogService,
        }),
      ).toThrowError('eventBus is required');
    });

    it('should set autoDownload to false', () => {
      expect(mockAutoUpdater.autoDownload).toBe(false);
    });

    it('should set autoInstallOnAppQuit to true', () => {
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    it('should register event listeners', () => {
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(mockAutoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('checkForUpdates', () => {
    it('should call autoUpdater.checkForUpdates', async () => {
      await service.checkForUpdates();
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it('should prevent duplicate checks', async () => {
      // First check starts
      const p1 = service.checkForUpdates();
      // Second check should be skipped
      await service.checkForUpdates();
      await p1;
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('should log check start', async () => {
      await service.checkForUpdates();
      expect(mockLogService.info).toHaveBeenCalledWith('main', 'Checking for updates...');
    });

    it('should reset checking on error', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('network error'));
      await expect(service.checkForUpdates()).rejects.toThrow('network error');
      expect(service.isChecking()).toBe(false);
    });
  });

  describe('downloadUpdate', () => {
    it('should call autoUpdater.downloadUpdate', async () => {
      await service.downloadUpdate();
      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled();
    });
  });

  describe('quitAndInstall', () => {
    it('should call autoUpdater.quitAndInstall', () => {
      service.quitAndInstall();
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    it('should emit update:available on update-available event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(
        ([event]: [string]) => event === 'update-available',
      )?.[1];
      expect(handler).toBeDefined();
      handler({ version: '2.0.0', releaseDate: '2024-01-01', releaseNotes: 'New stuff' });
      expect(mockEventBus.emit).toHaveBeenCalledWith('update:available', {
        version: '2.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New stuff',
      });
    });

    it('should emit update:notAvailable on update-not-available event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(
        ([event]: [string]) => event === 'update-not-available',
      )?.[1];
      handler();
      expect(mockEventBus.emit).toHaveBeenCalledWith('update:notAvailable');
    });

    it('should emit update:downloadProgress on download-progress event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(
        ([event]: [string]) => event === 'download-progress',
      )?.[1];
      handler({ percent: 50, bytesPerSecond: 1024, transferred: 512, total: 1024 });
      expect(mockEventBus.emit).toHaveBeenCalledWith('update:downloadProgress', {
        percent: 50,
        bytesPerSecond: 1024,
        transferred: 512,
        total: 1024,
      });
    });

    it('should emit update:downloaded on update-downloaded event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(
        ([event]: [string]) => event === 'update-downloaded',
      )?.[1];
      handler();
      expect(mockEventBus.emit).toHaveBeenCalledWith('update:downloaded');
    });

    it('should emit update:error on error event', () => {
      const handler = mockAutoUpdater.on.mock.calls.find(
        ([event]: [string]) => event === 'error',
      )?.[1];
      handler(new Error('Update failed'));
      expect(mockEventBus.emit).toHaveBeenCalledWith('update:error', { message: 'Update failed' });
    });
  });

  describe('isChecking', () => {
    it('should return false initially', () => {
      expect(service.isChecking()).toBe(false);
    });
  });
});
