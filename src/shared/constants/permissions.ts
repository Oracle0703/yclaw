/**
 * 插件权限级别常量
 * 三级权限模型
 */
export enum PermissionLevel {
  /** UI 只读 — 无需用户授权 */
  UI_READONLY = 1,
  /** 网络 + 存储 — 安装时需用户确认 */
  NETWORK_STORAGE = 2,
  /** 自动化 + 文件系统 — 每次使用需显式授权 */
  AUTOMATION_FILESYSTEM = 3,
}

export const PERMISSION_NAMES: Record<string, string> = {
  network: '网络请求',
  storage: '插件存储读写',
  filesystem: '用户文件系统访问',
  automation: '调用自动化引擎',
  webcontents: '操作 WebContentsView',
};

/** 各权限级别允许的权限集合 */
export const PERMISSION_LEVEL_CAPABILITIES: Record<PermissionLevel, string[]> = {
  [PermissionLevel.UI_READONLY]: ['ui', 'state:read'],
  [PermissionLevel.NETWORK_STORAGE]: ['ui', 'state:read', 'network', 'storage'],
  [PermissionLevel.AUTOMATION_FILESYSTEM]: [
    'ui',
    'state:read',
    'network',
    'storage',
    'filesystem',
    'automation',
    'webcontents',
  ],
};
