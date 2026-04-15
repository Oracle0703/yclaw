import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { InterventionPanel } from '@renderer/entries/browser/components/InterventionPanel';
import type { InterventionState } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';

describe('InterventionPanel', () => {
  const state: InterventionState = {
    taskId: 'task-1',
    batchId: 'batch-1',
    flowRunnerStatus: 'intervention',
    webContentsId: 101,
    sessionPartition: 'persist:session_a',
    breakpoint: {
      stepIndex: 2,
      error: 'login expired',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.invoke).mockResolvedValue({ success: true, data: null } as never);
  });

  it('renders breakpoint and current session info', () => {
    render(<InterventionPanel state={state} />);

    expect(screen.getByText(/task-1/)).toBeDefined();
    expect(screen.getByText(/batch-1/)).toBeDefined();
    expect(screen.getByText(/login expired/)).toBeDefined();
  });

  it('resumes automation through intervention:resume', () => {
    render(<InterventionPanel state={state} />);

    fireEvent.click(screen.getByRole('button', { name: /恢复自动执行/ }));

    expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.INTERVENTION_RESUME, {
      taskId: 'task-1',
      batchId: 'batch-1',
    });
  });
});
