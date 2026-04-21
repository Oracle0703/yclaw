import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Alert: ({ message }: { message: React.ReactNode }) => <div>{message}</div>,
  Button: ({
    children,
    onClick,
    htmlType,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    htmlType?: 'button' | 'submit';
  }) => (
    <button type={htmlType ?? 'button'} onClick={onClick}>
      {children}
    </button>
  ),
  Card: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
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
  Input: ({
    value,
    onChange,
    placeholder,
    type,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    type?: string;
  }) => (
    <input
      aria-label={placeholder}
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    />
  ),
  List: ({
    dataSource,
    renderItem,
  }: {
    dataSource?: Array<unknown>;
    renderItem: (item: unknown) => React.ReactNode;
  }) => <div>{(dataSource ?? []).map((item, index) => <div key={index}>{renderItem(item)}</div>)}</div>,
  Select: ({
    value,
    onChange,
    options,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    options?: Array<{ label: string; value: string }>;
  }) => (
    <select aria-label="tlsMode" value={value} onChange={(event) => onChange?.(event.target.value)}>
      {(options ?? []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
}));

import { RemoteRunnerPanel } from '@renderer/entries/automation/components/RemoteRunnerPanel';

describe('RemoteRunnerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:connection:list') {
        return [
          {
            id: 'runner-local',
            name: 'Local Runner',
            baseUrl: 'http://127.0.0.1:7421',
            authType: 'token',
            tokenRef: '***',
            workspaceId: 'default',
            tlsMode: 'insecure-dev',
            proxyUrl: null,
            status: 'online',
            lastSeenAt: null,
            createdAt: '2026-04-21T00:00:00.000Z',
            updatedAt: '2026-04-21T00:00:00.000Z',
          },
        ];
      }
      return {};
    });
  });

  it('loads and renders runner connections', async () => {
    render(<RemoteRunnerPanel />);

    expect(await screen.findByText('Local Runner')).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith('runner:connection:list');
  });

  it('submits a new connection and refreshes the list', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:connection:list') {
        return [];
      }
      if (channel === 'runner:connection:save') {
        return {
          id: 'runner-local',
          name: 'Local Runner',
        };
      }
      return {};
    });

    render(<RemoteRunnerPanel />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'Local Runner' } });
    fireEvent.change(screen.getByLabelText('http://127.0.0.1:7421'), { target: { value: 'http://127.0.0.1:7421' } });
    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'dev-token' } });
    fireEvent.change(screen.getByLabelText('workspace'), { target: { value: 'default' } });
    fireEvent.click(screen.getByRole('button', { name: '保存连接' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'runner:connection:save',
        expect.objectContaining({
          name: 'Local Runner',
          baseUrl: 'http://127.0.0.1:7421',
          token: 'dev-token',
          workspaceId: 'default',
        }),
      );
    });
  });

  it('creates and starts a sample remote execution from a connection row', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:connection:list') {
        return [
          {
            id: 'runner-local',
            name: 'Local Runner',
            baseUrl: 'http://127.0.0.1:7421',
            authType: 'token',
            tokenRef: '***',
            workspaceId: 'default',
            tlsMode: 'insecure-dev',
            proxyUrl: null,
            status: 'online',
            lastSeenAt: null,
            createdAt: '2026-04-21T00:00:00.000Z',
            updatedAt: '2026-04-21T00:00:00.000Z',
          },
        ];
      }
      if (channel === 'runner:task:save') {
        return {
          task: { id: 'task-remote', name: '远程示例任务' },
          revision: { revisionId: 'rev-1' },
        };
      }
      if (channel === 'runner:execution:start') {
        return {
          id: 'exec-1',
          taskId: 'task-remote',
          revisionId: 'rev-1',
          runnerId: 'runner-1',
          status: 'queued',
          triggeredBy: 'desktop',
          startedAt: null,
          finishedAt: null,
          cancelledBy: null,
          failureReason: null,
          currentStepId: null,
          retryCount: 0,
          resultSummary: null,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        };
      }
      if (channel === 'runner:execution:logs') {
        return [];
      }
      return {};
    });

    render(<RemoteRunnerPanel />);

    await screen.findByText('Local Runner');
    fireEvent.click(screen.getByRole('button', { name: '创建并启动示例任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'runner:task:save',
        expect.objectContaining({
          runnerConnectionId: 'runner-local',
          data: expect.objectContaining({
            name: '远程示例任务',
          }),
        }),
      );
      expect(invokeMock).toHaveBeenCalledWith(
        'runner:execution:start',
        expect.objectContaining({
          runnerConnectionId: 'runner-local',
          taskId: 'task-remote',
          revisionId: 'rev-1',
        }),
      );
    });
    expect(await screen.findByText('queued')).toBeDefined();
  });
});
