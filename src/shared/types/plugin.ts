import { PermissionLevel } from '../constants/permissions';

/**
 * 插件元信息（plugin.json 结构）
 */
export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  main: string;
  ui?: string;
  permissions: string[];
  permissionLevel: PermissionLevel;
  engines: {
    yclaw: string;
  };
  author?: string;
  homepage?: string;
}

/** 插件运行状态 */
export enum PluginStatus {
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

/** 插件注册表条目 */
export interface PluginRegistryEntry {
  manifest: PluginManifest;
  status: PluginStatus;
  path: string;
  loadedAt?: Date;
  error?: string;
}
