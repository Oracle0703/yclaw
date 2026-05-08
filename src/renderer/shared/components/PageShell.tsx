import type { PropsWithChildren, ReactNode } from 'react';
import { Button, Result, Skeleton } from 'antd';

interface PageShellProps extends PropsWithChildren {
  title: string;
  subTitle?: string;
  content?: ReactNode;
  extra?: ReactNode;
  /** 是否显示加载骨架屏 */
  loading?: boolean;
  /** 错误状态 */
  error?: Error | null;
  /** 错误时的重试回调 */
  onRetry?: () => void;
}

export function PageShell({
  loading,
  error,
  onRetry,
  children,
}: PageShellProps) {
  if (error) {
    return (
      <div className="yclaw-page-container">
        <div className="yclaw-page-shell yclaw-panel-card">
          <Result
            status="error"
            title="页面加载失败"
            subTitle={error.message}
            extra={
              onRetry ? (
                <Button type="primary" onClick={onRetry}>
                  重试
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="yclaw-page-container">
      <div className="yclaw-page-shell yclaw-panel-card">
        <div className="yclaw-page-shell-body">
          {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : children}
        </div>
      </div>
    </div>
  );
}
