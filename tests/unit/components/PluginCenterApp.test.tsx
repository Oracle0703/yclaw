import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { PluginStatus } from '@shared/types';

const { invokeMock, messageErrorMock, modalConfirmMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
  modalConfirmMock: vi.fn(),
}));

vi.mock('@ant-design/icons', () => ({
  DownloadOutlined: () => <span>download</span>,
  PlusOutlined: () => <span>plus</span>,
}));

vi.mock('antd', () => {
  const DescriptionsItem = ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );

  return {
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
    Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Descriptions: Object.assign(
      ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
      { Item: DescriptionsItem },
    ),
    Modal: Object.assign(
      ({
        children,
        open,
        title,
      }: {
        children?: React.ReactNode;
        open?: boolean;
        title?: React.ReactNode;
      }) => (open ? <section><h2>{title}</h2>{children}</section> : null),
      { confirm: modalConfirmMock },
    ),
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
  };
});

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

vi.mock('@renderer/entries/plugin-center/components/PluginCard', () => ({
  PluginCard: ({
    plugin,
    onToggle,
  }: {
    plugin: { manifest: { name: string; displayName: string } };
    onToggle: (name: string, active: boolean) => void;
  }) => (
    <div>
      <span>{plugin.manifest.displayName}</span>
      <button type="button" onClick={() => onToggle(plugin.manifest.name, false)}>
        停用插件
      </button>
    </div>
  ),
}));

vi.mock('@renderer/entries/plugin-center/components/PermissionDialog', () => ({
  PermissionDialog: () => <div>PermissionDialog</div>,
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
}));

import PluginCenterApp from '@renderer/entries/plugin-center/App';

const plugins = [
  {
    manifest: {
      name: 'demo-plugin',
      version: '1.0.0',
      displayName: 'Demo Plugin',
      description: 'Demo plugin',
      main: 'index.js',
      permissions: ['fs:read'],
      permissionLevel: 1,
      engines: { yclaw: '>=1.0.0' },
    },
    status: PluginStatus.ACTIVE,
    path: '/plugins/demo-plugin',
  },
];

describe('PluginCenter App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.PLUGIN_LIST) {
        return plugins;
      }

      return null;
    });
  });

  it('shows an error when loading plugins fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('load plugins failed'));

    render(<PluginCenterApp />);

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('load plugins failed');
    });
  });

  it('shows an error when toggling a plugin fails', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.PLUGIN_LIST) {
        return plugins;
      }

      if (channel === IPC_CHANNELS.PLUGIN_DISABLE) {
        throw new Error('toggle failed');
      }

      return null;
    });

    render(<PluginCenterApp />);

    expect(await screen.findByText('Demo Plugin')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '停用插件' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('toggle failed');
    });
  });
});
