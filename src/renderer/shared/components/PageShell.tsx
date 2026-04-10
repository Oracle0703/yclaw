import type { PropsWithChildren, ReactNode } from 'react';
import { Button, Result, Skeleton, Spin, Typography } from 'antd';
import { PageContainer } from '@ant-design/pro-components';

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
  title,
  subTitle,
  content,
  extra,
  loading,
  error,
  onRetry,
  children,
}: PageShellProps) {
  if (error) {
    return (
      <PageContainer title={false} className="yclaw-page-container">
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
      </PageContainer>
    );
  }

  return (
    <PageContainer title={false} className="yclaw-page-container">
      <div className="yclaw-page-shell yclaw-panel-card">
        <div className="yclaw-page-shell-header">
          <div className="yclaw-page-shell-main">
            <Typography.Title level={2} className="yclaw-page-shell-title">
              {title}
            </Typography.Title>
            {subTitle ? (
              <Typography.Paragraph className="yclaw-page-shell-subtitle">
                {subTitle}
              </Typography.Paragraph>
            ) : null}
            {content ? (
              <Typography.Paragraph className="yclaw-page-shell-content">
                {content}
              </Typography.Paragraph>
            ) : null}
          </div>
          {extra ? <div className="yclaw-page-shell-extra">{extra}</div> : null}
        </div>
        <div className="yclaw-page-shell-body">
          {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : children}
        </div>
      </div>
    </PageContainer>
  );
}
