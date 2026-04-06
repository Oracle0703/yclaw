import React, { useState, useCallback } from 'react';
import { TabBar } from './components/TabBar';
import { AddressBar } from './components/AddressBar';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import '../../shared/styles/globals.css';

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

  const createTab = useCallback(async () => {
    try {
      const res = await invoke<{ id: number }>('browser:createTab', { url: 'https://www.google.com' });
      if (res) {
        const newTab: Tab = { id: res.id, title: '新标签页', url: 'about:blank', loading: true };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(res.id);
      }
    } catch { /* ignore */ }
  }, [invoke]);

  const closeTab = useCallback(async (id: number) => {
    await invoke('browser:closeTab', { id });
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTabId((prev) => {
      if (prev === id) {
        const remaining = tabs.filter((t) => t.id !== id);
        return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      return prev;
    });
  }, [invoke, tabs]);

  const navigate = useCallback(async (url: string) => {
    if (activeTabId != null) {
      await invoke('browser:navigate', { tabId: activeTabId, url });
    }
  }, [invoke, activeTabId]);

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
    <div className="app browser-app">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitch={setActiveTabId}
        onClose={closeTab}
        onNew={createTab}
      />
      <AddressBar
        url={activeTab?.url ?? ''}
        canGoBack={false}
        canGoForward={false}
        onNavigate={navigate}
        onBack={() => invoke('browser:goBack', { tabId: activeTabId })}
        onForward={() => invoke('browser:goForward', { tabId: activeTabId })}
        onReload={() => invoke('browser:reload', { tabId: activeTabId })}
      />
      <div className="browser-viewport">
        {tabs.length === 0 && (
          <div className="empty-state">
            <p>点击 + 打开新标签页</p>
            <button onClick={createTab}>新建标签页</button>
          </div>
        )}
      </div>
    </div>
  );
}
