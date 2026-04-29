/**
 * 配置类型定义
 */

import type { AIConfig } from './ai';
import type { FeaturePackageInstallState } from './features';
import type { EmailNotificationConfig } from './signin';

export interface AppConfig {
  general: GeneralConfig;
  modules: Record<string, ModuleConfig>;
  plugins: Record<string, PluginConfig>;
  ai: AIConfig;
  featurePackages: Record<string, FeaturePackageInstallState>;
}

export interface GeneralConfig {
  theme: 'light' | 'dark' | 'system';
  language: string;
  startupBehavior: 'showWorkbench' | 'restoreLastSession' | 'minimizeToTray';
  closeToTray: boolean;
  notificationEmail?: EmailNotificationConfig;
  appearance?: AppearanceConfig;
}

/**
 * 全局外观配置（背景、未来可扩展为字体等）
 */
export interface AppearanceConfig {
  background: BackgroundConfig;
}

/**
 * 背景配置
 * - preset: 预置渐变（value 为预置 id）
 * - solid:  纯色（value 为 #RRGGBB）
 * - image:  图片（value 为 URL/data URL）
 */
export interface BackgroundConfig {
  type: 'preset' | 'solid' | 'image';
  value: string;
  /** 仅 image 生效，0~1，控制白色蒙层透明度，提升阅读对比度 */
  overlayOpacity?: number;
  /** 仅 image 生效 */
  fit?: 'cover' | 'contain' | 'tile';
}

export interface ModuleConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
}
