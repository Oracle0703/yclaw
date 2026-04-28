/**
 * 全局事件名常量
 */
export const EVENTS = {
  // 模块事件
  MODULE_OPENED: 'module:opened',
  MODULE_CLOSED: 'module:closed',

  // 配置变更
  CONFIG_CHANGED: 'config:changed',

  // 插件生命周期
  PLUGIN_ACTIVATED: 'plugin:activated',
  PLUGIN_DEACTIVATED: 'plugin:deactivated',
  PLUGIN_INSTALLED: 'plugin:installed',
  PLUGIN_UNINSTALLED: 'plugin:uninstalled',

  // 自动化任务
  TASK_STARTED: 'task:started',
  TASK_STEP_COMPLETED: 'task:step:completed',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_PAUSED: 'task:paused',
  TASK_STATUS_CHANGED: 'task:status:changed',

  // 股票数据
  STOCK_DATA_UPDATE: 'stock:data:update',
  STOCK_REALTIME_TICK: 'stock:realtime:tick',

  // 应用内导航（主进程通知 workbench 渲染端跳转到指定模块路由）
  APP_NAVIGATE: 'app:navigate',

  // 自动更新
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_NOT_AVAILABLE: 'update:notAvailable',
  UPDATE_DOWNLOAD_PROGRESS: 'update:downloadProgress',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
