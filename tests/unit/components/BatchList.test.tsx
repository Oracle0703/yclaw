import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TASK_BATCH_LIST, { taskId: 'task-1' });
      expect(screen.getByText('batch-running')).toBeDefined();
    });
  });

  it('filters batch rows by status', async () => {
    render(<BatchList taskId="task-1" onSelectBatch={vi.fn()} />);

    await waitFor(() => screen.getByText('batch-running'));
    fireEvent.click(screen.getByRole('button', { name: /仅失败/ }));

    expect(screen.queryByText('batch-running')).toBeNull();
    expect(screen.getByText('batch-failed')).toBeDefined();
  });
});
