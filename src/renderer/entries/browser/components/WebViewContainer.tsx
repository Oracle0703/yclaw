import { Descriptions, Empty, Tag, Typography } from 'antd';
import type { Tab } from '@shared/types/browser';

interface WebViewContainerProps {
  tab: Tab | null;
}

/**
 * 浏览器会话控制台
 * 当前版本明确展示标签元信息与会话状态，而不是伪装成真实嵌入浏览视图
 */
export function WebViewContainer({ tab }: WebViewContainerProps) {
  if (tab == null) {
    return (
      <Empty
        description="点击上方新建标签页，开始创建受控浏览会话"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="yclaw-webview-container" data-tab-id={tab.id}>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="标签标题">{tab.title || '新标签页'}</Descriptions.Item>
        <Descriptions.Item label="地址">{tab.url || 'about:blank'}</Descriptions.Item>
        <Descriptions.Item label="会话分区">
          <Tag color={tab.sessionPartition === 'default' ? 'blue' : 'processing'}>
            {tab.sessionPartition}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="导航能力">
          <Typography.Text>
            {tab.canGoBack ? '可后退' : '不可后退'} / {tab.canGoForward ? '可前进' : '不可前进'}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="加载状态">
          <Tag color={tab.loading ? 'processing' : 'success'}>
            {tab.loading ? '加载中' : '已就绪'}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
