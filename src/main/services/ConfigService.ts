import fs from 'fs';
import path from 'path';
import { getConfigPath } from '../utils/paths';
import type { EventBus } from '../ipc/EventBus';
import { EVENTS } from '@shared/constants';
import type { AppConfig, GeneralConfig } from '@shared/types';

const DEFAULT_CONFIG: AppConfig = {
  general: {
    theme: 'system',
    language: 'zh-CN',
    startupBehavior: 'showWorkbench',
    closeToTray: false,
    notificationEmail: {
      enabled: false,
      host: '',
      port: 465,
      secure: true,
      username: '',
      password: '',
      from: '',
      to: [],
    },
  },
  modules: {},
  plugins: {},
  featurePackages: {},
  ai: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 2048,
    mcp: {
      embeddedHttp: {
        host: '127.0.0.1',
        port: 3939,
      },
      servers: [],
    },
  },
};

/**
 * 配置管理服务
 * - JSON 文件持久化
 * - 变更广播
 * - 备份/导出/导入
 */
export class ConfigService {
  private config: AppConfig;
  private configFilePath: string;
  private eventBus: Pick<EventBus, 'emit'>;

  constructor(options: { eventBus?: Pick<EventBus, 'emit'> } = {}) {
    if (!options.eventBus) {
      throw new Error('eventBus is required');
    }

    const configDir = getConfigPath();
    fs.mkdirSync(configDir, { recursive: true });
    this.configFilePath = path.join(configDir, 'settings.json');
    this.eventBus = options.eventBus;
    this.config = this.load();
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.save();
    this.eventBus.emit(EVENTS.CONFIG_CHANGED, { key, value });
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  getGeneral(): GeneralConfig {
    return { ...this.config.general };
  }

  setGeneral(partial: Partial<GeneralConfig>): void {
    this.config.general = { ...this.config.general, ...partial };
    this.save();
    this.eventBus.emit(EVENTS.CONFIG_CHANGED, { key: 'general', value: this.config.general });
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
    this.eventBus.emit(EVENTS.CONFIG_CHANGED, { key: '*', value: this.config });
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(jsonString: string): void {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Invalid config format: expected a JSON object');
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.general !== undefined && (typeof obj.general !== 'object' || obj.general === null)) {
      throw new Error('Invalid config format: "general" must be an object');
    }
    if (obj.modules !== undefined && (typeof obj.modules !== 'object' || obj.modules === null)) {
      throw new Error('Invalid config format: "modules" must be an object');
    }
    if (obj.plugins !== undefined && (typeof obj.plugins !== 'object' || obj.plugins === null)) {
      throw new Error('Invalid config format: "plugins" must be an object');
    }
    if (
      obj.featurePackages !== undefined &&
      (typeof obj.featurePackages !== 'object' || obj.featurePackages === null)
    ) {
      throw new Error('Invalid config format: "featurePackages" must be an object');
    }
    this.config = { ...DEFAULT_CONFIG, ...parsed } as AppConfig;
    this.save();
    this.eventBus.emit(EVENTS.CONFIG_CHANGED, { key: '*', value: this.config });
  }

  private load(): AppConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch {
      // 配置文件损坏，使用默认值
    }
    return { ...DEFAULT_CONFIG };
  }

  private save(): void {
    fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
  }
}
