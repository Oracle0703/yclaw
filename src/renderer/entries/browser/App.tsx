import { useState } from 'react';
import { Button, Col, Descriptions, Empty, Row, Space, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import { useLoading } from '../../shared/hooks/useLoading';
import { AddressBar } from './components/AddressBar';
import { TabBar } from './components/TabBar';
import type { Tab } from '@shared/types/browser';

export default function App() {
  const { invoke } = useIpc();
  const { withLoading } = useLoading();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const browserKpis = [
    { title: '打开标签数', value: `${tabs.length}` },
    { title: '当前活动标签', value: activeTab?.title ?? '未选择' },
    { title: '活动地址', value: activeTab?.url ?? 'about:blank' },
  ] as const;

  const createTab = async () => {
    await withLoading(async () => {
      const res = await invoke<{ id: number }>(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: 'https://www.google.com',
      });
      if (res) {
        const newTab: Tab = { id: res.id, title: '新标签页', url: 'about:blank', loading: true };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(res.id);
      }
    }, '正在创建标签页...');
  };

  const closeTab = async (id: number) => {
    await invoke(IPC_CHANNELS.BROWSER_CLOSE_TAB, { id });
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      setActiveTabId((currentId) =>
        currentId === id
          ? remaining.length > 0
            ? remaining[remaining.length - 1].id
            : null
          : currentId,
      );
      return remaining;
    });
  };

  const navigate = async (url: string) => {
    if (activeTabId != null) {
      await invoke(IPC_CHANNELS.BROWSER_NAVIGATE, { tabId: activeTabId, url });
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
    <PageShell
      title="内嵌浏览器"
      subTitle="管理会话、标签页和受控导航"
      content="浏览器模块先以中台工作台形式组织标签、地址栏和当前会话元信息，后续可继续接入真实 WebContentsView 容器。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Browser</Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void createTab()}>
            新建标签页
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          {browserKpis.map((item) => (
            <Col xs={24} md={8} key={item.title}>
              <ProCard className="yclaw-panel-card yclaw-kpi-card" bordered={false}>
                <div className="yclaw-kpi-card-head">
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                </div>
                <Typography.Title
                  level={3}
                  className="yclaw-kpi-card-value yclaw-kpi-card-value-compact"
                >
                  {item.value}
                </Typography.Title>
              </ProCard>
            </Col>
          ))}
        </Row>

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
              onBack={() => void invoke(IPC_CHANNELS.BROWSER_GO_BACK, { tabId: activeTabId })}
              onForward={() => void invoke(IPC_CHANNELS.BROWSER_GO_FORWARD, { tabId: activeTabId })}
              onReload={() => void invoke(IPC_CHANNELS.BROWSER_RELOAD, { tabId: activeTabId })}
            />
          </Space>
        </ProCard>

        <ProCard className="yclaw-panel-card" title="当前视图">
          <div className="browser-viewport yclaw-browser-frame">
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
                    当前仓库先完成浏览器中台外壳和标签控制区，后续可以继续把真实的 WebContentsView
                    容器挂入这个区域。
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
    </PageShell>
  );
}
