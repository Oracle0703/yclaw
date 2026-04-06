import { useState } from 'react';
import { Button, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import { AddressBar } from './components/AddressBar';
import { TabBar } from './components/TabBar';

interface Tab {
  id: number;
  title: string;
  url: string;
  loading: boolean;
}

export default function App() {
  const { invoke } = useIpc();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const createTab = async () => {
    try {
      const res = await invoke<{ id: number }>('browser:createTab', { url: 'https://www.google.com' });
      if (res) {
        const newTab: Tab = { id: res.id, title: '新标签页', url: 'about:blank', loading: true };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(res.id);
      }
    } catch {
      // ignore browser errors in the renderer demo
    }
  };

  const closeTab = async (id: number) => {
    await invoke('browser:closeTab', { id });
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTabId((prev) => {
      if (prev === id) {
        const remaining = tabs.filter((t) => t.id !== id);
        return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      return prev;
    });
  };

  const navigate = async (url: string) => {
    if (activeTabId != null) {
      await invoke('browser:navigate', { tabId: activeTabId, url });
    }
  };

  useIpcEvent('tab:title', (data: unknown) => {
    const { id, title } = data as { id: number; title: string };
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  });

  useIpcEvent('tab:navigate', (data: unknown) => {
    const { id, url } = data as { id: number; url: string };
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, url } : t)));
  });

  useIpcEvent('tab:loading', (data: unknown) => {
    const { id, loading } = data as { id: number; loading: boolean };
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, loading } : t)));
  });

  return (
    <AdminPageLayout
      currentPath="/browser"
      title="内嵌浏览器"
      subTitle="管理会话、标签页和受控导航"
      content="浏览器模块先以中台工作台形式组织标签、地址栏和当前会话元信息，后续可继续接入真实 WebContentsView 容器。"
      extra={
        <Space>
          <Tag color="processing">Session Desk</Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void createTab()}>
            新建标签页
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <StatisticCard.Group direction="row">
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{ title: '打开标签数', value: tabs.length, suffix: '个' }}
          />
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{ title: '当前活动标签', value: activeTab?.title ?? '未选择' }}
          />
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{ title: '活动地址', value: activeTab?.url ?? 'about:blank' }}
          />
        </StatisticCard.Group>

        <ProCard className="yclaw-panel-card" title="会话控制台">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSwitch={setActiveTabId}
              onClose={(id) => {
                void closeTab(id);
              }}
              onNew={() => {
                void createTab();
              }}
            />
            <AddressBar
              url={activeTab?.url ?? ''}
              canGoBack={false}
              canGoForward={false}
              onNavigate={(url) => {
                void navigate(url);
              }}
              onBack={() => void invoke('browser:goBack', { tabId: activeTabId })}
              onForward={() => void invoke('browser:goForward', { tabId: activeTabId })}
              onReload={() => void invoke('browser:reload', { tabId: activeTabId })}
            />
          </Space>
        </ProCard>

        <ProCard className="yclaw-panel-card" title="当前视图">
          <div className="browser-viewport">
            {activeTab ? (
              <Descriptions bordered column={1}>
                <Descriptions.Item label="标题">{activeTab.title || '新标签页'}</Descriptions.Item>
                <Descriptions.Item label="URL">{activeTab.url}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={activeTab.loading ? 'processing' : 'success'}>
                    {activeTab.loading ? '加载中' : '已就绪'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="说明">
                  <Typography.Text type="secondary">
                    当前仓库先完成浏览器中台外壳和标签控制区，后续可以继续把真实的 WebContentsView 容器挂入这个区域。
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty
                description="点击上方新建标签页，开始创建受控浏览会话"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </ProCard>
      </Space>
    </AdminPageLayout>
  );
}
