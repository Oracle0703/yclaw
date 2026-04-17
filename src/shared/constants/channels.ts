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

  // 功能包
  FEATURE_PACKAGE_LIST: 'feature:list',
  FEATURE_PACKAGE_INSTALL: 'feature:install',

  // 日志
  LOG_WRITE: 'log:write',
  LOG_EXPORT: 'log:export',

  // 数据库（预留 — 尚未实现，请勿在渲染进程调用）
  // DB_QUERY: 'db:query',
  // DB_RUN: 'db:run',

  // 自动化任务
  TASK_START: 'task:start',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',
  TASK_STOP: 'task:stop',
  TASK_LIST: 'task:list',
  TASK_GET: 'task:get',
  TASK_SAVE: 'task:save',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_DETAIL: 'task:detail',
  TASK_CLONE: 'task:clone',
  TASK_STATUS_CHANGED: 'task:statusChanged',
  TASK_BATCH_LIST: 'batch:list',
  TASK_BATCH_DETAIL: 'batch:detail',
  BATCH_RETRY: 'batch:retry',
  SCHEDULER_STATUS: 'scheduler:status',

  // 股票
  STOCK_DATA: 'stock:data',
  STOCK_INDICATOR_CALC: 'stock:indicator:calc',
  // 以下预留 — 尚未实现
  // STOCK_SUBSCRIBE: 'stock:subscribe',
  // STOCK_UNSUBSCRIBE: 'stock:unsubscribe',

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

  // 浏览器标签页
  BROWSER_CREATE_TAB: 'browser:createTab',
  BROWSER_CLOSE_TAB: 'browser:closeTab',
  BROWSER_LIST_TABS: 'browser:listTabs',
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_GO_BACK: 'browser:goBack',
  BROWSER_GO_FORWARD: 'browser:goForward',
  BROWSER_RELOAD: 'browser:reload',
  INTERVENTION_STATUS: 'intervention:status',
  INTERVENTION_TAKEOVER: 'intervention:takeover',
  INTERVENTION_RESUME: 'intervention:resume',
  INTERVENTION_SCREENSHOT: 'intervention:screenshot',
  INTERVENTION_STEP_INFO: 'intervention:stepInfo',
  RECORDER_START: 'recorder:start',
  RECORDER_STOP: 'recorder:stop',
  RECORDER_ACTION: 'recorder:action',
  TEMPLATE_SAVE: 'template:save',
  TEMPLATE_LIST: 'template:list',
  TEMPLATE_DELETE: 'template:delete',
  RESULT_LIST: 'result:list',
  RESULT_DETAIL: 'result:detail',
  RESULT_EXPORT: 'result:export',
  RESULT_MARK_SUSPICIOUS: 'result:markSuspicious',
  SESSION_LIST: 'session:list',
  SESSION_CREATE: 'session:create',
  SESSION_DELETE: 'session:delete',
  SESSION_BIND: 'session:bind',
  EXEC_LOG_QUERY: 'execlog:query',
  ALERT_LIST: 'alert:list',
  ALERT_DISMISS: 'alert:dismiss',
  ALERT_PUSHED: 'alert:pushed',

  // AI 助手
  AI_CHAT: 'ai:chat',
  AI_CONFIG_GET: 'ai:config:get',
  AI_CONFIG_SET: 'ai:config:set',
  AI_TOOLS_LIST: 'ai:tools:list',
  AI_CONVERSATION_LIST: 'ai:conversation:list',
  AI_CONVERSATION_DELETE: 'ai:conversation:delete',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
