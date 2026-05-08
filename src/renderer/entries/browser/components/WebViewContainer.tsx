import { Descriptions, Empty, Tag, Typography } from 'antd';
import type { InterventionState, Tab } from '@shared/types/browser';

interface WebViewContainerProps {
  tab: Tab | null;
  interventionState?: InterventionState | null;
}

/**
 * 采集会话信息面板
 * 当前版本明确展示标签元信息与会话状态，而不是伪装成真实嵌入浏览视图
 */
export function WebViewContainer({ tab, interventionState = null }: WebViewContainerProps) {
  if (tab == null) {
    return (
      <Empty
        description="从上方平台分类选择站点，或新建空白采集页开始处理任务"
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
        {interventionState && (
          <>
            <Descriptions.Item label="介入批次">{interventionState.batchId}</Descriptions.Item>
            <Descriptions.Item label="介入状态">
              <Tag color="warning">{interventionState.flowRunnerStatus}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="断点错误">
              <Typography.Text>{interventionState.breakpoint?.error ?? '无'}</Typography.Text>
            </Descriptions.Item>
          </>
        )}
      </Descriptions>
    </div>
  );
}
