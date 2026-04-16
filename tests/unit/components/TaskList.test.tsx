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
  Table: ({
    dataSource = [],
    columns = [],
  }: {
    dataSource?: Array<Record<string, unknown>>;
    columns?: Array<Record<string, unknown>>;
  }) => (
    <table>
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
});
