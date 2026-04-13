import { Empty, Typography } from 'antd';

interface WebViewContainerProps {
  tabId: number | null;
  url: string;
}

/**
 * WebContentsView 容器占位组件
 * 后续迭代中将接入 Electron 的 WebContentsView 实现真实网页渲染
 */
export function WebViewContainer({ tabId, url }: WebViewContainerProps) {
  if (tabId == null) {
    return (
      <Empty
        description="点击上方新建标签页，开始创建受控浏览会话"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="yclaw-webview-container" data-tab-id={tabId}>
      <Typography.Text type="secondary">
        WebContentsView 容器 — Tab #{tabId} — {url || 'about:blank'}
      </Typography.Text>
    </div>
  );
}
