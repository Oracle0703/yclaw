import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageErrorMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
}));

vi.mock('@ant-design/icons', () => ({
  MinusOutlined: () => <span>minus</span>,
  CloseOutlined: () => <span>close</span>,
  SettingOutlined: () => <span>setting</span>,
  BorderOutlined: () => <span>border</span>,
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
      title,
      'aria-label': ariaLabel,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      title?: string;
      'aria-label'?: string;
    }) => (
      <button type="button" onClick={onClick} title={title} aria-label={ariaLabel}>
        {children}
      </button>
    ),
    Drawer: ({
      children,
      open,
      title,
    }: {
      children?: React.ReactNode;
      open?: boolean;
      title?: React.ReactNode;
    }) => (open ? <section><h2>{title}</h2>{children}</section> : null),
    Descriptions: Object.assign(
      ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
      { Item: DescriptionsItem },
    ),
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Title: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
    Divider: () => <hr />,
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    message: {
      error: messageErrorMock,
    },
  };
});

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
}));

import { TitleBar } from '@renderer/shared/components/TitleBar';

describe('TitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(null);
    window.location.hash = '#/';
  });

  it('shows an error when minimizing the window fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('minimize failed'));

    render(<TitleBar />);

    fireEvent.click(screen.getByTitle('最小化'));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('minimize failed');
    });
  });

  it('shows an error when loading settings fails', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.CONFIG_GET_ALL) {
        throw new Error('load settings failed');
      }

      return null;
    });

    render(<TitleBar />);

    fireEvent.click(screen.getByTitle('设置'));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('load settings failed');
    });
  });

  it('renders a plain hot shortcut in the global toolbar', () => {
    render(<TitleBar />);

    fireEvent.click(screen.getByRole('button', { name: '热点' }));

    expect(window.location.hash).toBe('#/hot-monitor');
  });
});
