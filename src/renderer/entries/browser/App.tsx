import { useState } from 'react';
import { Button, Col, Row, Space, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import { useLoading } from '../../shared/hooks/useLoading';
import { AddressBar } from './components/AddressBar';
import { TabBar } from './components/TabBar';
import { WebViewContainer } from './components/WebViewContainer';
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
      const res = await invoke<Tab>(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: 'https://www.google.com',
      });
      if (res) {
        setTabs((prev) => [...prev, res]);
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
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((t) => (t.id === nextTab.id ? { ...t, ...nextTab } : t)));
  });

  useIpcEvent('tab:navigate', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((t) => (t.id === nextTab.id ? { ...t, ...nextTab } : t)));
  });

  useIpcEvent('tab:loading', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((t) => (t.id === nextTab.id ? { ...t, ...nextTab } : t)));
  });

  return (
    <PageShell
      title="内嵌浏览器"
      subTitle="管理会话、标签页和受控导航"
      content="当前版本把浏览器模块收敛为浏览器会话控制台，聚焦标签、导航和会话分区管理。"
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
              canGoBack={activeTab?.canGoBack ?? false}
              canGoForward={activeTab?.canGoForward ?? false}
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
            <WebViewContainer tab={activeTab ?? null} />
          </div>
        </ProCard>
      </Space>
    </PageShell>
  );
}
