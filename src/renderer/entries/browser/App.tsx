import { useEffect, useState } from 'react';
import { Button, Card, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import { useLoading } from '../../shared/hooks/useLoading';
import { AddressBar } from './components/AddressBar';
import { RecorderPanel } from './components/RecorderPanel';
import { TabBar } from './components/TabBar';
import type { Tab } from '@shared/types/browser';
import './styles.css';

const DEFAULT_RECORDER_URL = 'https://www.jd.com/';

export default function App() {
  const { invoke } = useIpc();
  const { withLoading } = useLoading();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  const reportActionError = (error: unknown, fallbackMessage: string) => {
    message.error(error instanceof Error ? error.message : fallbackMessage);
  };

  useEffect(() => {
    void invoke<Tab[]>(IPC_CHANNELS.BROWSER_LIST_TABS)
      .then((existingTabs) => {
        if (existingTabs && existingTabs.length > 0) {
          setTabs(existingTabs);
          setActiveTabId(existingTabs[existingTabs.length - 1].id);
        }
      })
      .catch((error) => {
        reportActionError(error, '读取标签页失败');
      });
  }, [invoke]);

  const createTab = async (url = DEFAULT_RECORDER_URL): Promise<Tab | null> => {
    try {
      return await withLoading(async () => {
        const tab = await invoke<Tab>(IPC_CHANNELS.BROWSER_CREATE_TAB, { url });
        if (tab) {
          setTabs((prev) => {
            const withoutDuplicate = prev.filter((item) => item.id !== tab.id);
            return [...withoutDuplicate, tab];
          });
          setActiveTabId(tab.id);
        }
        return tab ?? null;
      }, '正在打开操作窗口...');
    } catch (error) {
      reportActionError(error, '打开操作窗口失败');
      return null;
    }
  };

  const closeTab = async (id: number) => {
    try {
      await invoke(IPC_CHANNELS.BROWSER_CLOSE_TAB, { id });
      setTabs((prev) => {
        const remaining = prev.filter((tab) => tab.id !== id);
        setActiveTabId((currentId) =>
          currentId === id ? (remaining[remaining.length - 1]?.id ?? null) : currentId,
        );
        return remaining;
      });
    } catch (error) {
      reportActionError(error, '关闭操作窗口失败');
    }
  };

  const navigate = async (url: string) => {
    if (activeTabId == null) {
      await createTab(url);
      return;
    }

    try {
      await invoke(IPC_CHANNELS.BROWSER_NAVIGATE, { tabId: activeTabId, url });
    } catch (error) {
      reportActionError(error, '页面跳转失败');
    }
  };

  const runTabAction = async (channel: string, fallbackMessage: string) => {
    if (activeTabId == null) {
      message.warning('请先打开操作窗口');
      return;
    }

    try {
      await invoke(channel, { tabId: activeTabId });
    } catch (error) {
      reportActionError(error, fallbackMessage);
    }
  };

  useIpcEvent('tab:title', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((tab) => (tab.id === nextTab.id ? { ...tab, ...nextTab } : tab)));
  });

  useIpcEvent('tab:navigate', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((tab) => (tab.id === nextTab.id ? { ...tab, ...nextTab } : tab)));
  });

  useIpcEvent('tab:loading', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((tab) => (tab.id === nextTab.id ? { ...tab, ...nextTab } : tab)));
  });

  return (
    <PageShell
      title="API 调查录制器"
      subTitle="打开真实操作窗口，手动完成签到/领豆，停止后导出请求记录"
      content="输入目标网址后打开窗口，再开始调查录制。其他无关浏览器工作台功能已移除。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Network Recorder</Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void createTab()}>
            打开操作窗口
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Card className="yclaw-panel-card" title="操作页面">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <AddressBar
              url={activeTab?.url ?? ''}
              canGoBack={activeTab?.canGoBack ?? false}
              canGoForward={activeTab?.canGoForward ?? false}
              onNavigate={(url) => {
                void navigate(url);
              }}
              onBack={() => {
                void runTabAction(IPC_CHANNELS.BROWSER_GO_BACK, '后退失败');
              }}
              onForward={() => {
                void runTabAction(IPC_CHANNELS.BROWSER_GO_FORWARD, '前进失败');
              }}
              onReload={() => {
                void runTabAction(IPC_CHANNELS.BROWSER_RELOAD, '刷新失败');
              }}
            />
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
            <Typography.Text type="secondary">
              {activeTab
                ? `当前操作窗口：${activeTab.title || activeTab.url || '新标签页'}`
                : '还没有操作窗口。点击“打开操作窗口”，或直接在地址栏输入网址后回车。'}
            </Typography.Text>
          </Space>
        </Card>

        <RecorderPanel
          tabId={activeTabId}
          onCreateTab={async () => (await createTab())?.id ?? null}
        />
      </Space>
    </PageShell>
  );
}
