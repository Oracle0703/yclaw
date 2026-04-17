import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageErrorMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Card: ({
    children,
    title,
  }: {
    children?: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
  Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: React.ReactNode }) => <strong>{children}</strong>,
  },
  message: {
    error: messageErrorMock,
  },
}));

vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => <span>plus</span>,
}));

vi.mock('@ant-design/pro-components', () => ({
  ProCard: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    extra,
    title,
  }: {
    children: React.ReactNode;
    extra: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{extra}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@renderer/entries/browser/components/TabBar', () => ({
  TabBar: () => <div>TabBar</div>,
}));

vi.mock('@renderer/entries/browser/components/AddressBar', () => ({
  AddressBar: ({
    onBack,
    onForward,
    onReload,
  }: {
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
  }) => (
    <div>
      <button type="button" onClick={onBack}>后退</button>
      <button type="button" onClick={onForward}>前进</button>
      <button type="button" onClick={onReload}>刷新</button>
    </div>
  ),
}));

vi.mock('@renderer/entries/browser/components/WebViewContainer', () => ({
  WebViewContainer: () => <div>WebView</div>,
}));

vi.mock('@renderer/entries/browser/components/InterventionPanel', () => ({
  InterventionPanel: () => <div>InterventionPanel</div>,
}));

vi.mock('@renderer/entries/browser/components/RecorderPanel', () => ({
  RecorderPanel: () => <div>RecorderPanel</div>,
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

const tabs = [
  {
    id: 1,
    title: '首页',
    url: 'https://example.com',
    loading: false,
    canGoBack: true,
    canGoForward: true,
  },
];

describe('Browser App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }
      return null;
    });
  });

  it('shows an error when loading tabs fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('list tabs failed'));

    render(<BrowserApp />);

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('list tabs failed');
    });
  });

  it('shows an error when reload fails', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.BROWSER_RELOAD) {
        throw new Error('reload failed');
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.BROWSER_LIST_TABS);
    });

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('reload failed');
    });
  });
});
