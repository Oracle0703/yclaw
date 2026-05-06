import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
  message: {
    error: vi.fn(),
  },
  Table: ({
    dataSource = [],
    columns = [],
    loading = false,
  }: {
    dataSource?: Array<Record<string, unknown>>;
    columns?: Array<Record<string, unknown>>;
    loading?: boolean;
  }) => (
    <table data-loading={String(loading)}>
      <tbody>
        {dataSource.map((record, rowIndex) => (
          <tr key={String(record.id ?? rowIndex)}>
            {columns.map((column, columnIndex) => {
              const key = String(column.key ?? column.dataIndex ?? columnIndex);
              const value =
                typeof column.dataIndex === 'string' ? record[column.dataIndex] : undefined;
              const content =
                typeof column.render === 'function'
                  ? column.render(value, record, rowIndex)
                  : value;

              return <td key={key}>{content as React.ReactNode}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

import { TaskList } from '@renderer/entries/automation/components/TaskList';
import { EVENTS, IPC_CHANNELS } from '@shared/constants';

describe('TaskList', () => {
  let taskStatusChangedHandler: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    taskStatusChangedHandler = undefined;
    vi.mocked(window.electronAPI.on).mockImplementation((channel, handler) => {
      if (channel === EVENTS.TASK_STATUS_CHANGED) {
        taskStatusChangedHandler = handler as () => void;
      }

      return () => {};
    });
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'task-1',
              name: '采集任务',
              status: 'idle',
              description: '普通任务',
              entryUrl: 'https://example.com/dashboard',
              updatedAt: '2026-04-15 10:00:00',
              latestBatch: {
                id: 'batch-1',
                status: 'failed',
              },
            },
          ],
        };
      }

      return { success: true, data: { status: 'running' } };
    });
  });

  it('renders task rows from task:list', async () => {
    render(<TaskList onSelect={vi.fn()} />);

    expect(await screen.findByText('采集任务')).toBeDefined();
    expect(screen.getByText('example.com')).toBeDefined();
  });

  it('filters to sign-in tasks and hides generic execution actions in signin scope', async () => {
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'task-generic-1',
              name: '普通采集任务',
              kind: 'generic',
              status: 'idle',
              updatedAt: '2026-04-15 09:59:00',
            },
            {
              id: 'task-signin-1',
              name: '京东签到',
              kind: 'jd-signin',
              status: 'idle',
              entryUrl: 'https://interact.jd.com/',
              updatedAt: '2026-04-15 10:00:00',
            },
          ],
        };
      }

      return { success: true, data: { status: 'running' } };
    });

    render(<TaskList onSelect={vi.fn()} scope="signin" enableExecutionActions={false} />);

    expect(await screen.findByText('京东签到')).toBeDefined();
    expect(screen.queryByText('普通采集任务')).toBeNull();
    expect(screen.queryByRole('button', { name: /启动/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /复跑/ })).toBeNull();
  });

  it('renders browser draft badges for transferred review tasks', async () => {
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'task-draft-1',
              name: '抖音 · 评论草案 · 04/27 02:40',
              status: 'idle',
              description: '这是任务草案，不是静默自动执行脚本。默认使用占位选择器，未人工修改前不要直接启动。',
              entryUrl: 'https://www.douyin.com/video/123',
              updatedAt: '2026-04-27 02:40:00',
            },
          ],
        };
      }

      return { success: true, data: { status: 'running' } };
    });

    render(<TaskList onSelect={vi.fn()} />);

    expect(await screen.findByText('评论草案')).toBeDefined();
    expect(screen.getByText('浏览器移交')).toBeDefined();
    expect(screen.getByText('需补选择器')).toBeDefined();
    expect(screen.getByText('douyin.com')).toBeDefined();
  });

  it('starts a task from the action column', async () => {
    render(<TaskList onSelect={vi.fn()} />);

    await screen.findByText('采集任务');
    fireEvent.click(screen.getByRole('button', { name: /启动/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TASK_START, { taskId: 'task-1' });
    });
  });

  it('retries the latest failed batch from the action column', async () => {
    render(<TaskList onSelect={vi.fn()} />);

    await screen.findByText('采集任务');
    fireEvent.click(screen.getByRole('button', { name: /复跑/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.BATCH_RETRY, { batchId: 'batch-1' });
    });
  });

  it('shows an error message when starting a task fails', async () => {
    const { message } = await import('antd');

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'task-1',
              name: '采集任务',
              status: 'idle',
              updatedAt: '2026-04-15 10:00:00',
              latestBatch: {
                id: 'batch-1',
                status: 'failed',
              },
            },
          ],
        };
      }

      if (channel === IPC_CHANNELS.TASK_START) {
        return Promise.reject(new Error('start failed')) as never;
      }

      return { success: true, data: { status: 'running' } };
    });

    render(<TaskList onSelect={vi.fn()} />);

    await screen.findByText('采集任务');
    fireEvent.click(screen.getByRole('button', { name: /启动/ }));

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('start failed');
    });
  });

  it('shows an error message when retrying a batch fails', async () => {
    const { message } = await import('antd');

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'task-1',
              name: '采集任务',
              status: 'idle',
              updatedAt: '2026-04-15 10:00:00',
              latestBatch: {
                id: 'batch-1',
                status: 'failed',
              },
            },
          ],
        };
      }

      if (channel === IPC_CHANNELS.BATCH_RETRY) {
        return Promise.reject(new Error('retry failed')) as never;
      }

      return { success: true, data: { status: 'running' } };
    });

    render(<TaskList onSelect={vi.fn()} />);

    await screen.findByText('采集任务');
    fireEvent.click(screen.getByRole('button', { name: /复跑/ }));

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('retry failed');
    });
  });

  it('ignores stale task list responses after a newer refresh', async () => {
    let resolveInitialList: (value: unknown) => void = () => {};
    let resolveRefreshList: (value: unknown) => void = () => {};
    let listCallCount = 0;

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel !== IPC_CHANNELS.TASK_LIST) {
        return { success: true, data: { status: 'running' } };
      }

      listCallCount += 1;
      if (listCallCount === 1) {
        return new Promise((resolve) => {
          resolveInitialList = resolve;
        }) as never;
      }

      return new Promise((resolve) => {
        resolveRefreshList = resolve;
      }) as never;
    });

    render(<TaskList onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(taskStatusChangedHandler).toBeDefined();
    });

    await act(async () => {
      taskStatusChangedHandler?.();
    });

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveRefreshList({
        success: true,
        data: [
          {
            id: 'task-new',
            name: '新任务',
            status: 'running',
            updatedAt: '2026-04-15 10:01:00',
          },
        ],
      });
    });

    expect(await screen.findByText('新任务')).toBeDefined();

    await act(async () => {
      resolveInitialList({
        success: true,
        data: [
          {
            id: 'task-old',
            name: '旧任务',
            status: 'idle',
            updatedAt: '2026-04-15 10:00:00',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('旧任务')).toBeNull();
    });
    expect(screen.getByText('新任务')).toBeDefined();
  });

  it('stops loading when task refresh fails', async () => {
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return Promise.reject(new Error('network down')) as never;
      }

      return { success: true, data: { status: 'running' } };
    });

    render(<TaskList onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TASK_LIST);
    });

    await waitFor(() => {
      expect(screen.getByRole('table').getAttribute('data-loading')).toBe('false');
    });
  });
});
