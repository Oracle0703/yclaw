import type { PropsWithChildren, ReactNode } from 'react';
import { Typography } from 'antd';
import { PageContainer } from '@ant-design/pro-components';

interface PageShellProps extends PropsWithChildren {
  title: string;
  subTitle?: string;
  content?: ReactNode;
  extra?: ReactNode;
}

export function PageShell({ title, subTitle, content, extra, children }: PageShellProps) {
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
        <div className="yclaw-page-shell-body">{children}</div>
      </div>
    </PageContainer>
  );
}
