/**
 * 配置类型定义
 */

export interface AppConfig {
  general: GeneralConfig;
  modules: Record<string, ModuleConfig>;
  plugins: Record<string, PluginConfig>;
}

export interface GeneralConfig {
  theme: 'light' | 'dark' | 'system';
  language: string;
  startupBehavior: 'showWorkbench' | 'restoreLastSession' | 'minimizeToTray';
  closeToTray: boolean;
}

export interface ModuleConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
}
