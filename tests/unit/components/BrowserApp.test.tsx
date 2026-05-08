import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageErrorMock, messageWarningMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageWarningMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    disabled,
    icon,
    onClick,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    icon?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Card: ({
    children,
    extra,
    title,
  }: {
    children?: React.ReactNode;
    extra?: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {extra}
      {children}
    </section>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
  message: {
    error: messageErrorMock,
    warning: messageWarningMock,
  },
}));

vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => <span aria-hidden="true">plus</span>,
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    content,
    extra,
    subTitle,
    title,
  }: {
    children: React.ReactNode;
    content?: React.ReactNode;
    extra: React.ReactNode;
    subTitle?: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      <p>{content}</p>
      <div>{extra}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock('@renderer/entries/browser/components/TabBar', () => ({
  TabBar: ({
    activeTabId,
    onClose,
    onNew,
    onSwitch,
    tabs,
  }: {
    activeTabId: number | null;
    onClose: (id: number) => void;
    onNew: () => void;
    onSwitch: (id: number) => void;
    tabs: Array<{ id: number; title: string; url: string }>;
  }) => (
    <div>
      <button type="button" onClick={onNew}>
        新建标签
      </button>
      {tabs.map((tab) => (
        <div key={tab.id}>
          <button type="button" onClick={() => onSwitch(tab.id)}>
            {tab.title}
          </button>
          <button type="button" onClick={() => onClose(tab.id)}>
            关闭 {tab.title}
          </button>
          <span>{tab.id === activeTabId ? `active:${tab.url}` : tab.url}</span>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@renderer/entries/browser/components/AddressBar', () => ({
  AddressBar: ({
    onBack,
    onForward,
    onNavigate,
    onReload,
    url,
  }: {
    onBack: () => void;
    onForward: () => void;
    onNavigate: (url: string) => void;
    onReload: () => void;
    url: string;
  }) => (
    <div>
      <input
        aria-label="地址"
        defaultValue={url}
        onChange={(event) => {
          event.currentTarget.dataset.value = event.currentTarget.value;
        }}
      />
      <button
        type="button"
        onClick={() => {
          const input = screen.getByLabelText('地址') as HTMLInputElement;
          onNavigate(input.value);
        }}
      >
        跳转
      </button>
      <button type="button" onClick={onBack}>
        后退
      </button>
      <button type="button" onClick={onForward}>
        前进
      </button>
      <button type="button" onClick={onReload}>
        刷新
      </button>
    </div>
  ),
}));

vi.mock('@renderer/entries/browser/components/RecorderPanel', () => ({
  RecorderPanel: ({
    onCreateTab,
    tabId,
  }: {
    onCreateTab?: () => Promise<number | null>;
    tabId: number | null;
  }) => (
    <div>
      <span>RecorderPanel tab:{tabId ?? 'none'}</span>
      <button type="button" onClick={() => void onCreateTab?.()}>
        录制器打开窗口
      </button>
    </div>
  ),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
  useIpcEvent: vi.fn(),
}));

vi.mock('@renderer/shared/hooks/useLoading', () => ({
  useLoading: () => ({
    withLoading: async <T,>(task: () => Promise<T>) => task(),
  }),
}));

import BrowserApp from '@renderer/entries/browser/App';

const existingTabs = [
  {
    id: 1,
    title: '首页',
    url: 'https://example.com',
    loading: false,
    canGoBack: true,
    canGoForward: true,
    sessionPartition: 'default',
  },
];

describe('Browser App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return existingTabs;
      }
      return null;
    });
  });

  it('renders the current API investigation recorder shell with existing tabs', async () => {
    render(<BrowserApp />);

    expect(screen.getByRole('heading', { name: 'API 调查录制器' })).toBeDefined();
    expect(screen.getByText('Network Recorder')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('当前操作窗口：首页')).toBeDefined();
      expect(screen.getByText('RecorderPanel tab:1')).toBeDefined();
    });
  });

  it('shows an error when loading tabs fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('list tabs failed'));

    render(<BrowserApp />);

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('list tabs failed');
    });
  });

  it('opens the default recorder page from the page action', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return [];
      }
      if (channel === IPC_CHANNELS.BROWSER_CREATE_TAB) {
        expect(payload).toEqual({ url: 'https://www.jd.com/' });
        return {
          id: 2,
          title: '京东',
          url: 'https://www.jd.com/',
          loading: false,
          canGoBack: false,
          canGoForward: false,
          sessionPartition: 'default',
        };
      }
      return null;
    });

    render(<BrowserApp />);

    fireEvent.click(screen.getByRole('button', { name: /打开操作窗口/ }));

    await waitFor(() => {
      expect(screen.getByText('当前操作窗口：京东')).toBeDefined();
      expect(screen.getByText('RecorderPanel tab:2')).toBeDefined();
    });
  });

  it('opens the requested URL when navigating without an active tab', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return [];
      }
      if (channel === IPC_CHANNELS.BROWSER_CREATE_TAB) {
        expect(payload).toEqual({ url: 'https://interact.jd.com' });
        return {
          id: 3,
          title: '活动页',
          url: 'https://interact.jd.com',
          loading: false,
          canGoBack: false,
          canGoForward: false,
          sessionPartition: 'default',
        };
      }
      return null;
    });

    render(<BrowserApp />);

    const input = screen.getByLabelText('地址') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://interact.jd.com' } });
    fireEvent.click(screen.getByRole('button', { name: '跳转' }));

    await waitFor(() => {
      expect(screen.getByText('当前操作窗口：活动页')).toBeDefined();
    });
  });

  it('navigates the active tab through browser IPC', async () => {
    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('当前操作窗口：首页')).toBeDefined());

    const input = screen.getByLabelText('地址') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://m.jd.com' } });
    fireEvent.click(screen.getByRole('button', { name: '跳转' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.BROWSER_NAVIGATE, {
        tabId: 1,
        url: 'https://m.jd.com',
      });
    });
  });

  it('reports reload failures from the active tab action', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return existingTabs;
      }
      if (channel === IPC_CHANNELS.BROWSER_RELOAD) {
        throw new Error('reload failed');
      }
      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('当前操作窗口：首页')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('reload failed');
    });
  });

  it('warns when running tab actions without an active tab', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return [];
      }
      return null;
    });

    render(<BrowserApp />);

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    await waitFor(() => {
      expect(messageWarningMock).toHaveBeenCalledWith('请先打开操作窗口');
    });
  });

  it('passes a create-tab callback to the recorder panel', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return [];
      }
      if (channel === IPC_CHANNELS.BROWSER_CREATE_TAB) {
        return {
          id: 4,
          title: '录制窗口',
          url: 'https://www.jd.com/',
          loading: false,
          canGoBack: false,
          canGoForward: false,
          sessionPartition: 'default',
        };
      }
      return null;
    });

    render(<BrowserApp />);

    fireEvent.click(screen.getByRole('button', { name: '录制器打开窗口' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: 'https://www.jd.com/',
      });
      expect(screen.getByText('RecorderPanel tab:4')).toBeDefined();
    });
  });

  it('closes an active tab and falls back to the previous tab', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return [
          existingTabs[0],
          {
            id: 2,
            title: '活动页',
            url: 'https://interact.jd.com',
            loading: false,
            canGoBack: false,
            canGoForward: false,
            sessionPartition: 'default',
          },
        ];
      }
      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('当前操作窗口：活动页')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: '关闭 活动页' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.BROWSER_CLOSE_TAB, { id: 2 });
      expect(screen.getByText('当前操作窗口：首页')).toBeDefined();
    });
  });
});
