/**
 * IPC 通道名常量 — 类型安全的通道定义
 * 命名规范: {module}:{action}:{detail?}
 */
export const IPC_CHANNELS = {
  // 窗口管理
  WINDOW_OPEN: 'window:open',
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_LIST: 'window:list',

  // 配置
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',
  CONFIG_RESET: 'config:reset',
  CONFIG_EXPORT: 'config:export',
  CONFIG_IMPORT: 'config:import',

  // 日志
  LOG_WRITE: 'log:write',
  LOG_EXPORT: 'log:export',

  // 数据库
  DB_QUERY: 'db:query',
  DB_RUN: 'db:run',

  // 自动化任务
  TASK_START: 'task:start',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',
  TASK_STOP: 'task:stop',
  TASK_STATUS: 'task:status',
  TASK_LIST: 'task:list',
  TASK_SAVE: 'task:save',
  TASK_DELETE: 'task:delete',

  // 股票
  STOCK_SUBSCRIBE: 'stock:subscribe',
  STOCK_UNSUBSCRIBE: 'stock:unsubscribe',
  STOCK_DATA: 'stock:data',
  STOCK_INDICATOR_CALC: 'stock:indicator:calc',

  // 插件
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_INSTALL: 'plugin:install',
  PLUGIN_UNINSTALL: 'plugin:uninstall',
  PLUGIN_ENABLE: 'plugin:enable',
  PLUGIN_DISABLE: 'plugin:disable',
  PLUGIN_PERMISSION_CHECK: 'plugin:permission:check',

  // 应用
  APP_INFO: 'app:info',
  APP_CHECK_UPDATE: 'app:checkUpdate',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
