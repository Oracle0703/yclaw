import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Spin } from 'antd';

interface LoadingContextValue {
  /** 当前是否正在 loading */
  loading: boolean;
  /** 开始 loading，可附带提示文字 */
  showLoading: (tip?: string) => void;
  /** 结束 loading */
  hideLoading: () => void;
  /**
   * 包装一个异步函数，执行期间自动显示/隐藏 loading
   * @returns 原始异步函数的返回值
   */
  withLoading: <T>(fn: () => Promise<T>, tip?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [tip, setTip] = useState<string | undefined>();
  const countRef = useRef(0); // 支持并发调用计数，防止提前关闭

  const showLoading = useCallback((nextTip?: string) => {
    countRef.current += 1;
    setTip(nextTip);
    setLoading(true);
  }, []);

  const hideLoading = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) {
      setLoading(false);
      setTip(undefined);
    }
  }, []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, loadingTip?: string): Promise<T> => {
      showLoading(loadingTip);
      try {
        return await fn();
      } finally {
        hideLoading();
      }
    },
    [showLoading, hideLoading],
  );

  return (
    <LoadingContext.Provider value={{ loading, showLoading, hideLoading, withLoading }}>
      {loading && <Spin spinning tip={tip ?? '加载中...'} size="large" fullscreen delay={100} />}
      {children}
    </LoadingContext.Provider>
  );
}

/**
 * 使用全局 loading 控制
 *
 * @example
 * const { withLoading } = useLoading();
 * await withLoading(() => invoke('browser:createTab'), '正在创建标签页...');
 */
export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return ctx;
}
