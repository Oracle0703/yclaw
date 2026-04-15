import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExecutionPanel } from '@renderer/entries/automation/components/ExecutionPanel';
import { IPC_CHANNELS } from '@shared/constants';

// window.electronAPI is mocked globally in tests/setup.ts

describe('ExecutionPanel', () => {
  const defaultProps = {
    taskId: 'task-1',
    status: 'idle',
    currentStep: 0,
    totalSteps: 5,
    logs: [] as string[],
    hasBreakpoint: false,
  };

  const renderExecutionPanel = async (
    props: Partial<typeof defaultProps> & { onJumpToBatch?: (batchId: string) => void; onError?: (message: string) => void } = {},
  ) => {
    const mergedProps = { ...defaultProps, ...props };
    render(<ExecutionPanel {...mergedProps} />);
    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.ALERT_LIST, {
        taskId: mergedProps.taskId,
      });
    });
    return mergedProps;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.ALERT_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'alert-1',
              taskId: 'task-1',
              batchId: 'batch-1',
              message: '任务失败，请检查登录状态',
              createdAt: '2026-04-15T00:00:00.000Z',
              read: false,
            },
          ],
        } as never;
      }

      return { success: true, data: null } as never;
    });
  });

  it('should render execution panel header', async () => {
    await renderExecutionPanel();
    expect(screen.getByText('执行面板')).toBeDefined();
  });

  it('should display status', async () => {
    await renderExecutionPanel({ status: 'running' });
    expect(screen.getByText(/running/)).toBeDefined();
  });

  it('should render start button', async () => {
    await renderExecutionPanel();
    expect(screen.getByRole('button', { name: /启\s*动/ })).toBeDefined();
  });

  it('should render pause button', async () => {
    await renderExecutionPanel({ status: 'running' });
    expect(screen.getByRole('button', { name: /暂\s*停/ })).toBeDefined();
  });

  it('should render resume button', async () => {
    await renderExecutionPanel({ status: 'paused' });
    expect(screen.getByRole('button', { name: /继\s*续/ })).toBeDefined();
  });

  it('should render stop button', async () => {
    await renderExecutionPanel({ status: 'running' });
    expect(screen.getByRole('button', { name: /停\s*止/ })).toBeDefined();
  });

  it('should display progress', async () => {
    await renderExecutionPanel({ status: 'running', currentStep: 3, totalSteps: 5 });
    expect(screen.getByText('3 / 5')).toBeDefined();
  });

  it('should display logs', async () => {
    const logs = ['Step 1 completed', 'Step 2 failed'];
    await renderExecutionPanel({ logs });
    expect(screen.getByText('Step 1 completed')).toBeDefined();
    expect(screen.getByText('Step 2 failed')).toBeDefined();
  });

  it('should show breakpoint resume button when hasBreakpoint', async () => {
    await renderExecutionPanel({ hasBreakpoint: true });
    expect(screen.getByText(/从断点继续/)).toBeDefined();
  });

  it('should disable start when running', async () => {
    await renderExecutionPanel({ status: 'running' });
    const startBtn = screen.getByRole('button', { name: /启\s*动/ });
    expect(startBtn).toHaveProperty('disabled', true);
  });

  it('should call invoke on start click', async () => {
    await renderExecutionPanel();
    fireEvent.click(screen.getByRole('button', { name: /启\s*动/ }));
    expect(window.electronAPI.invoke).toHaveBeenCalled();
  });

  it('shows recent alerts', async () => {
    await renderExecutionPanel();

    expect(await screen.findByText(/任务失败，请检查登录状态/)).toBeDefined();
    expect(screen.getByText(/未读/)).toBeDefined();
  });

  it('jumps to the batch linked to an alert', async () => {
    const onJumpToBatch = vi.fn();
    await renderExecutionPanel({ onJumpToBatch });

    fireEvent.click(await screen.findByRole('button', { name: /跳转到批次/ }));

    expect(onJumpToBatch).toHaveBeenCalledWith('batch-1');
  });

  it('marks an alert as read', async () => {
    await renderExecutionPanel();

    fireEvent.click(await screen.findByRole('button', { name: /标记已读/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.ALERT_DISMISS, {
        alertId: 'alert-1',
      });
    });
  });

  it('surfaces dismiss alert failures through onError', async () => {
    const onError = vi.fn();
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.ALERT_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'alert-1',
              taskId: 'task-1',
              batchId: 'batch-1',
              message: '任务失败，请检查登录状态',
              createdAt: '2026-04-15T00:00:00.000Z',
              read: false,
            },
          ],
        } as never;
      }

      if (channel === IPC_CHANNELS.ALERT_DISMISS) {
        return {
          success: false,
          error: { message: 'dismiss failed' },
        } as never;
      }

      return { success: true, data: null } as never;
    });

    await renderExecutionPanel({ onError });

    fireEvent.click(await screen.findByRole('button', { name: /标记已读/ }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('dismiss failed');
    });
  });
});
