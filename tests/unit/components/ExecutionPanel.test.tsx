import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('antd', () => {
  function MockList({
    dataSource = [],
    renderItem,
  }: {
    dataSource?: Array<Record<string, unknown> | string>;
    renderItem: (item: Record<string, unknown> | string) => React.ReactNode;
  }) {
    return <div>{dataSource.map((item, index) => React.createElement(React.Fragment, { key: String((item as { id?: string }).id ?? index) }, renderItem(item)))}</div>;
  }

  function MockListItem({
    children,
    actions,
  }: {
    children?: React.ReactNode;
    actions?: React.ReactNode[];
  }) {
    return (
      <div>
        {children}
        {actions}
      </div>
    );
  }
  MockList.Item = MockListItem;

  return {
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
    List: MockList,
    Progress: ({ percent }: { percent?: number }) => <div>{percent}%</div>,
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
      Title: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    },
  };
});

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
}));

import { ExecutionPanel } from '@renderer/entries/automation/components/ExecutionPanel';
import { IPC_CHANNELS } from '@shared/constants';

describe('ExecutionPanel', () => {
  type ExecutionPanelTestProps = React.ComponentProps<typeof ExecutionPanel>;

  const defaultProps: ExecutionPanelTestProps = {
    taskId: null,
    status: 'idle',
    currentStep: 0,
    totalSteps: 5,
    logs: [] as string[],
    hasBreakpoint: false,
  };

  const renderExecutionPanel = (
    props: Partial<ExecutionPanelTestProps> = {},
  ) => {
    const mergedProps = { ...defaultProps, ...props };
    render(<ExecutionPanel {...mergedProps} />);
    return mergedProps;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.ALERT_LIST) {
        return [
          {
            id: 'alert-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            message: '任务失败，请检查登录状态',
            createdAt: '2026-04-15T00:00:00.000Z',
            read: false,
          },
        ] as never;
      }

      return null as never;
    });
  });

  it('should render execution panel header', () => {
    renderExecutionPanel();
    expect(screen.getByText('执行面板')).toBeDefined();
  });

  it('should display status', () => {
    renderExecutionPanel({ status: 'running' });
    expect(screen.getByText(/running/)).toBeDefined();
  });

  it('should render start button', () => {
    renderExecutionPanel();
    expect(screen.getByRole('button', { name: /启\s*动/ })).toBeDefined();
  });

  it('should render pause button', () => {
    renderExecutionPanel({ status: 'running' });
    expect(screen.getByRole('button', { name: /暂\s*停/ })).toBeDefined();
  });

  it('should render resume button', () => {
    renderExecutionPanel({ status: 'paused' });
    expect(screen.getByRole('button', { name: /继\s*续/ })).toBeDefined();
  });

  it('should render stop button', () => {
    renderExecutionPanel({ status: 'running' });
    expect(screen.getByRole('button', { name: /停\s*止/ })).toBeDefined();
  });

  it('should display progress', () => {
    renderExecutionPanel({ status: 'running', currentStep: 3, totalSteps: 5 });
    expect(screen.getByText('3 / 5')).toBeDefined();
  });

  it('should display logs', () => {
    const logs = ['Step 1 completed', 'Step 2 failed'];
    renderExecutionPanel({ logs });
    expect(screen.getByText('Step 1 completed')).toBeDefined();
    expect(screen.getByText('Step 2 failed')).toBeDefined();
  });

  it('should show breakpoint resume button when hasBreakpoint', () => {
    renderExecutionPanel({ hasBreakpoint: true });
    expect(screen.getByText(/从断点继续/)).toBeDefined();
  });

  it('should disable start when running', () => {
    renderExecutionPanel({ status: 'running' });
    const startBtn = screen.getByRole('button', { name: /启\s*动/ });
    expect(startBtn).toHaveProperty('disabled', true);
  });

  it('should call invoke on start click', async () => {
    renderExecutionPanel({ taskId: 'task-1' });
    await screen.findByText(/任务失败，请检查登录状态/);
    invokeMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /启\s*动/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.TASK_START, {
        taskId: 'task-1',
      });
    });
  });

  it('does not refetch alerts when only onError callback identity changes', async () => {
    const firstOnError = vi.fn();
    const { rerender } = render(
      <ExecutionPanel
        {...defaultProps}
        taskId="task-1"
        onError={firstOnError}
      />,
    );

    await screen.findByText(/任务失败，请检查登录状态/);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    rerender(
      <ExecutionPanel
        {...defaultProps}
        taskId="task-1"
        onError={vi.fn()}
      />,
    );

    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('shows recent alerts', async () => {
    renderExecutionPanel({ taskId: 'task-1' });

    expect(await screen.findByText(/任务失败，请检查登录状态/)).toBeDefined();
    expect(screen.getByText(/未读/)).toBeDefined();
  });

  it('jumps to the batch linked to an alert', async () => {
    const onJumpToBatch = vi.fn();
    renderExecutionPanel({ taskId: 'task-1', onJumpToBatch });

    fireEvent.click(await screen.findByRole('button', { name: /跳转到批次/ }));

    expect(onJumpToBatch).toHaveBeenCalledWith('batch-1');
  });

  it('marks an alert as read', async () => {
    renderExecutionPanel({ taskId: 'task-1' });

    fireEvent.click(await screen.findByRole('button', { name: /标记已读/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.ALERT_DISMISS, {
        alertId: 'alert-1',
      });
    });
  });

  it('surfaces dismiss alert failures through onError', async () => {
    const onError = vi.fn();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.ALERT_LIST) {
        return [
          {
            id: 'alert-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            message: '任务失败，请检查登录状态',
            createdAt: '2026-04-15T00:00:00.000Z',
            read: false,
          },
        ] as never;
      }

      if (channel === IPC_CHANNELS.ALERT_DISMISS) {
        throw new Error('dismiss failed');
      }

      return null as never;
    });

    renderExecutionPanel({ taskId: 'task-1', onError });

    fireEvent.click(await screen.findByRole('button', { name: /标记已读/ }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('dismiss failed');
    });
  });
});
