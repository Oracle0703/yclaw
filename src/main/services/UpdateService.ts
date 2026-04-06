import { autoUpdater } from 'electron-updater';
import { EventBus } from '../ipc/EventBus';
import { LogService } from './LogService';
import { EVENTS } from '@shared/constants';

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
      this.eventBus.emit(EVENTS.UPDATE_AVAILABLE, {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: this.normalizeReleaseNotes(info.releaseNotes),
      } satisfies UpdateInfo);
      this.checking = false;
    });

    autoUpdater.on('update-not-available', () => {
      this.logService.info('main', 'No updates available');
      this.eventBus.emit(EVENTS.UPDATE_NOT_AVAILABLE);
      this.checking = false;
    });

    autoUpdater.on('download-progress', (progress) => {
      this.eventBus.emit(EVENTS.UPDATE_DOWNLOAD_PROGRESS, {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', () => {
      this.logService.info('main', 'Update downloaded, will install on quit');
      this.eventBus.emit(EVENTS.UPDATE_DOWNLOADED);
    });

    autoUpdater.on('error', (err) => {
      this.logService.error('main', `Update error: ${err.message}`);
      this.eventBus.emit(EVENTS.UPDATE_ERROR, { message: err.message });
      this.checking = false;
    });
  }

  private normalizeReleaseNotes(
    releaseNotes: string | { note: string }[] | null | undefined,
  ): string | undefined {
    if (typeof releaseNotes === 'string') {
      return releaseNotes;
    }

    if (Array.isArray(releaseNotes)) {
      return releaseNotes.map((note) => note.note).filter(Boolean).join('\n\n') || undefined;
    }

    return undefined;
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
