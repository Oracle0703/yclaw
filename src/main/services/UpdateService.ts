import { autoUpdater } from 'electron-updater';
import { EventBus } from '../ipc/EventBus';
import { LogService } from './LogService';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

/**
 * 自动更新服务 — 基于 electron-updater
 */
export class UpdateService {
  private eventBus: EventBus;
  private logService: LogService;
  private checking = false;

  constructor(logService: LogService) {
    this.eventBus = EventBus.getInstance();
    this.logService = logService;
    this.setupListeners();
  }

  private setupListeners(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      this.logService.info('main', `Update available: ${info.version}`);
      this.eventBus.emit('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      } satisfies UpdateInfo);
      this.checking = false;
    });

    autoUpdater.on('update-not-available', () => {
      this.logService.info('main', 'No updates available');
      this.eventBus.emit('update:notAvailable');
      this.checking = false;
    });

    autoUpdater.on('download-progress', (progress) => {
      this.eventBus.emit('update:downloadProgress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', () => {
      this.logService.info('main', 'Update downloaded, will install on quit');
      this.eventBus.emit('update:downloaded');
    });

    autoUpdater.on('error', (err) => {
      this.logService.error('main', `Update error: ${err.message}`);
      this.eventBus.emit('update:error', { message: err.message });
      this.checking = false;
    });
  }

  /**
   * 手动检查更新
   */
  async checkForUpdates(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    this.logService.info('main', 'Checking for updates...');
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      this.checking = false;
      throw err;
    }
  }

  /**
   * 下载已发现的更新
   */
  async downloadUpdate(): Promise<void> {
    await autoUpdater.downloadUpdate();
  }

  /**
   * 退出并安装
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  isChecking(): boolean {
    return this.checking;
  }
}
