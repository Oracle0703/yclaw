import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
  message: {
    error: vi.fn(),
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

import { ResultTable } from '@renderer/entries/automation/components/ResultTable';
import { IPC_CHANNELS } from '@shared/constants';

describe('ResultTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.RESULT_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'result-1',
              taskId: 'task-1',
              batchId: 'batch-1',
              data: { price: 123 },
              status: 'normal',
              createdAt: '2026-04-15T10:00:00.000Z',
            },
          ],
        };
      }

      return {
        success: true,
        data: { path: 'C:\\temp\\results.csv' },
      };
    });
  });

  it('renders result rows for the selected batch', async () => {
    render(<ResultTable taskId="task-1" batchId="batch-1" />);

    expect(await screen.findByText('result-1')).toBeDefined();
    expect(await screen.findByText(/123/)).toBeDefined();
  });

  it('exports current results as csv', async () => {
    render(<ResultTable taskId="task-1" batchId="batch-1" />);

    await screen.findByText('result-1');
    fireEvent.click(screen.getByRole('button', { name: /导出 CSV/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.RESULT_EXPORT, {
        taskId: 'task-1',
        batchId: 'batch-1',
        format: 'csv',
      });
    });
  });

  it('shows an error message when export fails', async () => {
    const { message } = await import('antd');

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.RESULT_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'result-1',
              taskId: 'task-1',
              batchId: 'batch-1',
              data: { price: 123 },
              status: 'normal',
              createdAt: '2026-04-15T10:00:00.000Z',
            },
          ],
        };
      }

      if (channel === IPC_CHANNELS.RESULT_EXPORT) {
        return Promise.reject(new Error('export failed')) as never;
      }

      return {
        success: true,
        data: { path: 'C:\\temp\\results.csv' },
      };
    });

    render(<ResultTable taskId="task-1" batchId="batch-1" />);

    await screen.findByText('result-1');
    fireEvent.click(screen.getByRole('button', { name: /导出 CSV/ }));

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('export failed');
    });
  });

  it('ignores stale result responses after task changes', async () => {
    let resolveTask1: (value: unknown) => void = () => {};
    let resolveTask2: (value: unknown) => void = () => {};

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel, params) => {
      if (channel !== IPC_CHANNELS.RESULT_LIST) {
        return { success: true, data: { path: 'C:\\temp\\results.csv' } };
      }

      if ((params as { taskId?: string }).taskId === 'task-1') {
        return new Promise((resolve) => {
          resolveTask1 = resolve;
        }) as never;
      }

      return new Promise((resolve) => {
        resolveTask2 = resolve;
      }) as never;
    });

    const { rerender } = render(<ResultTable taskId="task-1" batchId="batch-1" />);
    rerender(<ResultTable taskId="task-2" batchId="batch-2" />);

    await act(async () => {
      resolveTask2({
        success: true,
        data: [
          {
            id: 'result-task-2',
            taskId: 'task-2',
            batchId: 'batch-2',
            data: { price: 456 },
            status: 'normal',
            createdAt: '2026-04-15T10:00:00.000Z',
          },
        ],
      });
    });

    expect(await screen.findByText('result-task-2')).toBeDefined();

    await act(async () => {
      resolveTask1({
        success: true,
        data: [
          {
            id: 'result-task-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { price: 123 },
            status: 'normal',
            createdAt: '2026-04-15T09:00:00.000Z',
          },
        ],
      });
    });

    expect(screen.queryByText('result-task-1')).toBeNull();
    expect(screen.getByText('result-task-2')).toBeDefined();
  });

  it('handles result loading failures without unhandled rejection', async () => {
    const { message } = await import('antd');

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel) => {
      if (channel === IPC_CHANNELS.RESULT_LIST) {
        return Promise.reject(new Error('load results failed')) as never;
      }

      return { success: true, data: { path: 'C:\\temp\\results.csv' } };
    });

    render(<ResultTable taskId="task-1" batchId="batch-1" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(message.error).toHaveBeenCalledWith('load results failed');
  });
});
