import { ipcMain } from 'electron';
import type { IpcResponse } from '@shared/types';
import type { IpcHandler } from './channels';

/**
 * IPC 控制器 — 路由注册与分发
 */
export class IpcController {
  private handlers = new Map<string, IpcHandler>();
  private rateLimits = new Map<string, { count: number; resetTime: number }>();
  private readonly maxCallsPerSecond = 100;

  /**
   * 注册 IPC handle 路由
   */
  handle(channel: string, handler: IpcHandler): void {
    if (this.handlers.has(channel)) {
      throw new Error(`IPC channel "${channel}" is already registered`);
    }
    this.handlers.set(channel, handler);

    ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<IpcResponse> => {
      // 频率限制
      if (!this.checkRateLimit(channel)) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Channel "${channel}" rate limit exceeded (${this.maxCallsPerSecond}/s)`,
          },
        };
      }

      try {
        const result = await handler(...args);
        return { success: true, data: result };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return {
          success: false,
          error: {
            code: 'HANDLER_ERROR',
            message: error.message,
          },
        };
      }
    });
  }

  /**
   * 移除 IPC handle
   */
  removeHandler(channel: string): void {
    this.handlers.delete(channel);
    ipcMain.removeHandler(channel);
  }

  /**
   * 获取所有已注册通道
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 频率限制检查
   */
  private checkRateLimit(channel: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(channel);

    if (!limit || now >= limit.resetTime) {
      this.rateLimits.set(channel, { count: 1, resetTime: now + 1000 });
      return true;
    }

    limit.count++;
    return limit.count <= this.maxCallsPerSecond;
  }

  /**
   * 清理所有 handler
   */
  dispose(): void {
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }
    this.handlers.clear();
    this.rateLimits.clear();
  }
}
