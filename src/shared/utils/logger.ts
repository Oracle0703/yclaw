export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'main' | 'renderer' | 'plugin' | 'engine';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  data?: unknown;
}

/**
 * 统一日志格式化
 */
export function formatLogEntry(
  level: LogLevel,
  source: LogSource,
  message: string,
  data?: unknown,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    data,
  };
}

export function logEntryToString(entry: LogEntry): string {
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}${dataStr}`;
}
