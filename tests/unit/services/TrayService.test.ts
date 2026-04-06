import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron
vi.mock('electron', () => ({
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  })),
  Menu: {
    buildFromTemplate: vi.fn().mockReturnValue({}),
  },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({ isEmpty: () => true }),
    createEmpty: vi.fn().mockReturnValue({}),
  },
  app: {
    quit: vi.fn(),
  },
}));

// Mock EventBus
vi.mock('@main/ipc/EventBus', () => ({
  EventBus: {
    getInstance: vi.fn().mockReturnValue({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }),
  },
}));

// Mock WindowManager
const mockWindowManager = {
  openWindow: vi.fn(),
  closeWindow: vi.fn(),
  closeAll: vi.fn(),
  getOpenModules: vi.fn().mockReturnValue([]),
};

import { TrayService } from '@main/services/TrayService';
import { Tray, Menu, nativeImage, app } from 'electron';

describe('TrayService', () => {
  let service: TrayService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TrayService(mockWindowManager as any);
  });

  describe('create', () => {
    it('should create a tray instance', () => {
      service.create();
      expect(Tray).toHaveBeenCalled();
      expect(service.isCreated()).toBe(true);
    });

    it('should set tooltip', () => {
      service.create();
      const trayInstance = (Tray as any).mock.results[0].value;
      expect(trayInstance.setToolTip).toHaveBeenCalledWith('YClaw');
    });

    it('should build context menu', () => {
      service.create();
      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: '显示主窗口' }),
          expect.objectContaining({ label: '检查更新' }),
          expect.objectContaining({ label: '退出' }),
        ]),
      );
    });

    it('should set context menu on tray', () => {
      service.create();
      const trayInstance = (Tray as any).mock.results[0].value;
      expect(trayInstance.setContextMenu).toHaveBeenCalled();
    });

    it('should register double-click handler', () => {
      service.create();
      const trayInstance = (Tray as any).mock.results[0].value;
      expect(trayInstance.on).toHaveBeenCalledWith('double-click', expect.any(Function));
    });

    it('should handle missing icon gracefully', () => {
      (nativeImage.createFromPath as any).mockReturnValueOnce({ isEmpty: () => true });
      expect(() => service.create()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should destroy tray', () => {
      service.create();
      const trayInstance = (Tray as any).mock.results[0].value;
      service.destroy();
      expect(trayInstance.destroy).toHaveBeenCalled();
      expect(service.isCreated()).toBe(false);
    });

    it('should no-op when no tray exists', () => {
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('isCreated', () => {
    it('should return false initially', () => {
      expect(service.isCreated()).toBe(false);
    });

    it('should return true after create', () => {
      service.create();
      expect(service.isCreated()).toBe(true);
    });
  });
});
