import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { EventBus } from '../ipc/EventBus';
import { WindowManager } from '../windows/WindowManager';

/**
 * 系统托盘服务
 */
export class TrayService {
  private tray: Tray | null = null;
  private eventBus: EventBus;
  private windowManager: WindowManager;

  constructor(windowManager: WindowManager) {
    this.eventBus = EventBus.getInstance();
    this.windowManager = windowManager;
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
