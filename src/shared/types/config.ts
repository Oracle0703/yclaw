/**
 * 配置类型定义
 */

import type { AIConfig } from './ai';

export interface AppConfig {
  general: GeneralConfig;
  modules: Record<string, ModuleConfig>;
  plugins: Record<string, PluginConfig>;
  ai: AIConfig;
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
