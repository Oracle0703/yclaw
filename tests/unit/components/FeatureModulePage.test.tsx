import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@ant-design/icons', () => ({
  AppstoreAddOutlined: () => <span>appstore</span>,
  CloudDownloadOutlined: () => <span>download</span>,
  LinkOutlined: () => <span>link</span>,
}));

vi.mock('antd', () => ({
  Alert: ({
    message,
    description,
  }: {
    message?: React.ReactNode;
    description?: React.ReactNode;
  }) => (
    <div>
      <div>{message}</div>
      <div>{description}</div>
    </div>
  ),
  Button: ({
    children,
    disabled,
    loading,
    onClick,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
  Result: ({
    title,
    subTitle,
    extra,
  }: {
    title?: React.ReactNode;
    subTitle?: React.ReactNode;
    extra?: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <div>{subTitle}</div>
      <div>{extra}</div>
    </section>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  },
}));

import { FeatureModulePage } from '@renderer/shared/components/FeatureModulePage';
import { IPC_CHANNELS } from '@shared/constants';

describe('FeatureModulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.FEATURE_PACKAGE_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'stock',
              module: 'stock',
              displayName: '股票分析',
              version: '1.0.0',
              installed: true,
              installedAt: '2026-04-16T00:00:00.000Z',
              entryPath: 'C:/features/stock/index.html',
            },
          ],
        };
      }

      if (channel === IPC_CHANNELS.FEATURE_PACKAGE_INSTALL) {
        return {
          success: true,
          data: {
            id: 'stock',
            module: 'stock',
            version: '1.0.0',
            installed: true,
            installedAt: '2026-04-16T00:00:00.000Z',
            entryPath: 'C:/features/stock/index.html',
          },
        };
      }

      return { success: true, data: null };
    });
  });

  it('opens the feature module window when the package is available', async () => {
    render(
      <FeatureModulePage
        moduleId="stock"
        title="股票分析"
        description="股票模块"
      />,
    );

    await screen.findByText('可启动');
    fireEvent.click(screen.getByRole('button', { name: '打开模块窗口' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_OPEN, { module: 'stock' });
    });
  });

  it('shows an error when opening the feature module window fails', async () => {
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.FEATURE_PACKAGE_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'stock',
              module: 'stock',
              displayName: '股票分析',
              version: '1.0.0',
              installed: true,
              installedAt: '2026-04-16T00:00:00.000Z',
              entryPath: 'C:/features/stock/index.html',
            },
          ],
        };
      }

      if (channel === IPC_CHANNELS.WINDOW_OPEN) {
        return Promise.reject(new Error('open failed')) as never;
      }

      return { success: true, data: null };
    });

    render(
      <FeatureModulePage
        moduleId="stock"
        title="股票分析"
        description="股票模块"
      />,
    );

    await screen.findByText('可启动');
    fireEvent.click(screen.getByRole('button', { name: '打开模块窗口' }));

    expect(await screen.findByText('open failed')).toBeDefined();
  });

  it('ignores stale feature package responses after module changes', async () => {
    let resolveStockList: (value: unknown) => void = () => {};
    let resolveAutomationList: (value: unknown) => void = () => {};
    let listCallCount = 0;

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel !== IPC_CHANNELS.FEATURE_PACKAGE_LIST) {
        return { success: true, data: null };
      }

      listCallCount += 1;
      if (listCallCount === 1) {
        return new Promise((resolve) => {
          resolveStockList = resolve;
        }) as never;
      }

      return new Promise((resolve) => {
        resolveAutomationList = resolve;
      }) as never;
    });

    const { rerender } = render(
      <FeatureModulePage
        moduleId="stock"
        title="股票分析"
        description="股票模块"
      />,
    );

    rerender(
      <FeatureModulePage
        moduleId="automation"
        title="自动化采集"
        description="自动化模块"
      />,
    );

    await act(async () => {
      resolveAutomationList({
        success: true,
        data: [
          {
            id: 'automation',
            module: 'automation',
            displayName: '自动化采集',
            version: '2.0.0',
            installed: true,
            installedAt: '2026-04-16T00:00:00.000Z',
            entryPath: 'C:/features/automation/index.html',
          },
        ],
      });
    });

    expect(await screen.findByText('版本 2.0.0')).toBeDefined();

    await act(async () => {
      resolveStockList({
        success: true,
        data: [
          {
            id: 'stock',
            module: 'stock',
            displayName: '股票分析',
            version: '1.0.0',
            installed: true,
            installedAt: '2026-04-16T00:00:00.000Z',
            entryPath: 'C:/features/stock/index.html',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('版本 1.0.0')).toBeNull();
    });
    expect(screen.getByText('版本 2.0.0')).toBeDefined();
  });
});
