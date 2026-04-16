import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('antd', () => {
  function MockList({
    dataSource = [],
    renderItem,
  }: {
    dataSource?: Array<Record<string, unknown>>;
    renderItem: (item: Record<string, unknown>) => React.ReactNode;
  }) {
    return <div>{dataSource.map((item) => React.createElement(React.Fragment, { key: String(item.id) }, renderItem(item)))}</div>;
  }
  function MockListItem({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) {
    return (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    );
  }
  MockList.Item = MockListItem;

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
    List: MockList,
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
  };
});

import { BatchList } from '@renderer/entries/automation/components/BatchList';
import { IPC_CHANNELS } from '@shared/constants';

describe('BatchList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.invoke).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'batch-running',
          taskId: 'task-1',
          status: 'running',
          createdAt: '2026-04-15T10:00:00.000Z',
          stepResults: [],
        },
        {
          id: 'batch-failed',
          taskId: 'task-1',
          status: 'failed',
          createdAt: '2026-04-15T09:00:00.000Z',
          stepResults: [],
        },
      ],
    } as never);
  });

  it('loads batch list for the selected task', async () => {
    render(<BatchList taskId="task-1" onSelectBatch={vi.fn()} />);

    expect(await screen.findByText('batch-running')).toBeDefined();
    expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TASK_BATCH_LIST, {
      taskId: 'task-1',
    });
  });

  it('filters batch rows by status', async () => {
    render(<BatchList taskId="task-1" onSelectBatch={vi.fn()} />);

    await screen.findByText('batch-running');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /仅失败/ }));
    });

    expect(screen.queryByText('batch-running')).toBeNull();
    expect(screen.getByText('batch-failed')).toBeDefined();
  });
});
