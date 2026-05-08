import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import type { EventBus } from '../ipc/EventBus';
import { WindowManager } from '../windows/WindowManager';

interface TrayServiceOptions {
  eventBus?: Pick<EventBus, 'emit'>;
  windowManager?: WindowManager;
}

/**
 * 系统托盘服务
 */
export class TrayService {
  private tray: Tray | null = null;
  private eventBus: Pick<EventBus, 'emit'>;
  private windowManager: WindowManager;

  constructor(options: TrayServiceOptions = {}) {
    if (!options.eventBus) {
      throw new Error('eventBus is required');
    }

    if (!options.windowManager) {
      throw new Error('windowManager is required');
    }

    this.eventBus = options.eventBus;
    this.windowManager = options.windowManager;
  }

  create(): void {
    const iconPath = path.join(__dirname, '../../resources/icon.png');
    let icon: Electron.NativeImage;
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      }
    } catch {
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('YClaw');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          this.windowManager.openWindow({ module: 'workbench' });
        },
      },
      { type: 'separator' },
      {
        label: '检查更新',
        click: () => {
          this.eventBus.emit('app:checkUpdate');
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.windowManager.allowQuit();
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    this.tray.on('double-click', () => {
      this.windowManager.openWindow({ module: 'workbench' });
    });
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  isCreated(): boolean {
    return this.tray !== null;
  }
}
