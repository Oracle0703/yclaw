import fs from 'fs';
import path from 'path';
import type { AppConfig, MediaCrawlerConfig, MediaCrawlerRunRequest } from '@shared/types';
import type { ConfigService } from '../ConfigService';
import type { MediaCrawlerExternalExecutor } from './MediaCrawlerExternalExecutor';

const DEFAULT_MEDIACRAWLER_CONFIG: MediaCrawlerConfig = {
  enabled: false,
  repoPath: '',
  pythonPath: 'python',
  loginType: 'qrcode',
};

export class MediaCrawlerService {
  constructor(private readonly options: {
    configService: Pick<ConfigService, 'get' | 'set'>;
    executor: Pick<MediaCrawlerExternalExecutor, 'run'>;
  }) {}

  getConfig(): MediaCrawlerConfig {
    const modules = this.options.configService.get('modules');
    const settings = modules.commentMonitor?.settings as { mediaCrawler?: Partial<MediaCrawlerConfig> } | undefined;
    return {
      ...DEFAULT_MEDIACRAWLER_CONFIG,
      ...(settings?.mediaCrawler ?? {}),
    };
  }

  saveConfig(config: MediaCrawlerConfig): MediaCrawlerConfig {
    const modules = this.options.configService.get('modules');
    this.options.configService.set('modules', {
      ...modules,
      commentMonitor: {
        enabled: modules.commentMonitor?.enabled ?? true,
        settings: {
          ...(modules.commentMonitor?.settings ?? {}),
          mediaCrawler: config,
        },
      },
    });
    return config;
  }

  testConfig(config?: Partial<MediaCrawlerConfig>): { ok: boolean; mainPath: string } {
    const next = { ...this.getConfig(), ...(config ?? {}) };
    const mainPath = path.join(next.repoPath, 'main.py');
    if (!next.repoPath || !fs.existsSync(mainPath)) {
      throw new Error(`MediaCrawler main.py not found: ${mainPath}`);
    }
    return { ok: true, mainPath };
  }

  run(request: MediaCrawlerRunRequest) {
    return this.options.executor.run(request);
  }
}

export function readMediaCrawlerConfigFromAppConfig(config: AppConfig): MediaCrawlerConfig {
  const settings = config.modules.commentMonitor?.settings as { mediaCrawler?: Partial<MediaCrawlerConfig> } | undefined;
  return {
    ...DEFAULT_MEDIACRAWLER_CONFIG,
    ...(settings?.mediaCrawler ?? {}),
  };
}
