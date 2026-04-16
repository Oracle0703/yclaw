/**
 * 错误重试策略 & 断点继续逻辑
 */
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * 带递增延迟的重试
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.baseDelay * Math.pow(2, attempt),
          opts.maxDelay ?? 30000,
        );
        await (opts.sleep ?? sleep)(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 断点信息
 */
export interface Breakpoint {
  taskId: string;
  stepIndex: number;
  timestamp: string;
  error?: string;
}

export function createBreakpoint(taskId: string, stepIndex: number, error?: string): Breakpoint {
  return {
    taskId,
    stepIndex,
    timestamp: new Date().toISOString(),
    error,
  };
}
