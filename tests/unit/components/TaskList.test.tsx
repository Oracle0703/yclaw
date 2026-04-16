import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
import { IPC_CHANNELS } from '@shared/constants';

describe('TaskList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
