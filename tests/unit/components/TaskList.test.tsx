import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    await waitFor(() => {
      expect(screen.getByText('采集任务')).toBeDefined();
    });
  });

  it('starts a task from the action column', async () => {
    render(<TaskList onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('采集任务'));
    fireEvent.click(screen.getByRole('button', { name: /启动/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TASK_START, { taskId: 'task-1' });
    });
  });

  it('retries the latest failed batch from the action column', async () => {
    render(<TaskList onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('采集任务'));
    fireEvent.click(screen.getByRole('button', { name: /复跑/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.BATCH_RETRY, { batchId: 'batch-1' });
    });
  });
});
