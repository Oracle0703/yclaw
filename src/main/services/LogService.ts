import fs from 'fs';
import path from 'path';
import { getLogPath } from '../utils/paths';
import { formatLogEntry, logEntryToString, type LogLevel, type LogSource } from '@shared/utils';

/**
 * 日志服务
 * - 分级日志 (debug/info/warn/error)
 * - 文件轮转（按日）
 * - 多来源标记
 * - 保留 7 天
 */
export class LogService {
  private logDir: string;
  private currentDate: string = '';
  private currentLogFile: string = '';
  private readonly retentionDays = 7;

  constructor() {
    this.logDir = getLogPath();
    fs.mkdirSync(this.logDir, { recursive: true });
    this.rotateIfNeeded();
    this.cleanOldLogs();
  }

  debug(source: LogSource, message: string, data?: unknown): void {
    this.write('debug', source, message, data);
  }

  info(source: LogSource, message: string, data?: unknown): void {
    this.write('info', source, message, data);
  }

  warn(source: LogSource, message: string, data?: unknown): void {
    this.write('warn', source, message, data);
  }

  error(source: LogSource, message: string, data?: unknown): void {
    this.write('error', source, message, data);
  }

  write(level: LogLevel, source: LogSource, message: string, data?: unknown): void {
    this.rotateIfNeeded();
    const entry = formatLogEntry(level, source, message, data);
    const line = logEntryToString(entry) + '\n';

    fs.appendFileSync(this.currentLogFile, line, 'utf-8');

    // 同时输出到控制台
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(line.trimEnd());
  }

  /**
   * 导出调试包（最近 3 天日志 + 系统信息）
   */
  exportDebugPackage(): string {
    const files = fs.readdirSync(this.logDir)
      .filter((f) => f.endsWith('.log'))
      .sort()
      .slice(-3);

    let content = `=== YClaw Debug Package ===\n`;
    content += `Date: ${new Date().toISOString()}\n`;
    content += `Platform: ${process.platform}\n`;
    content += `Node: ${process.version}\n\n`;

    for (const file of files) {
      content += `\n=== ${file} ===\n`;
      content += fs.readFileSync(path.join(this.logDir, file), 'utf-8');
    }

    return content;
  }

  close(): void {
    // no-op: using sync writes
  }

  private rotateIfNeeded(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.currentLogFile = path.join(this.logDir, `${today}.log`);
    }
  }

  private cleanOldLogs(): void {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    try {
      const files = fs.readdirSync(this.logDir).filter((f) => f.endsWith('.log'));
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // 清理失败不影响运行
    }
  }
}
