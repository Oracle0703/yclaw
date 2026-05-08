import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { messageErrorMock } = vi.hoisted(() => ({
  messageErrorMock: vi.fn(),
}));

vi.mock('antd', () => {
  function MockDescriptions({ children }: { children?: React.ReactNode }) {
    return <dl>{children}</dl>;
  }
  function MockDescriptionsItem({
    children,
    label,
  }: {
    children?: React.ReactNode;
    label?: React.ReactNode;
  }) {
    return (
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    );
  }
  MockDescriptions.Item = MockDescriptionsItem;

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
    Card: ({
      children,
      title,
      extra,
    }: {
      children?: React.ReactNode;
      title?: React.ReactNode;
      extra?: React.ReactNode;
    }) => (
      <section className="yclaw-panel-card">
        <header>
          <div>{title}</div>
          <div>{extra}</div>
        </header>
        {children}
      </section>
    ),
    Descriptions: MockDescriptions,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
    message: {
      error: messageErrorMock,
    },
  };
});

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

  it('shows an error when resuming automation fails', async () => {
    vi.mocked(window.electronAPI.invoke).mockRejectedValueOnce(new Error('resume failed') as never);

    render(<InterventionPanel state={state} />);

    fireEvent.click(screen.getByRole('button', { name: /恢复自动执行/ }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('resume failed');
    });
  });
});
