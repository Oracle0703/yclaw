import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
});
