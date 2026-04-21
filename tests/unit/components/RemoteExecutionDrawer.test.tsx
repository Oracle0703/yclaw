import { describe, expect, it, vi } from 'vitest';
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
  Drawer: ({
    children,
    open,
    title,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    title?: React.ReactNode;
  }) => (open ? <section><h2>{title}</h2>{children}</section> : null),
  List: ({
    dataSource,
    renderItem,
  }: {
    dataSource?: Array<unknown>;
    renderItem: (item: unknown) => React.ReactNode;
  }) => <div>{(dataSource ?? []).map((item, index) => <div key={index}>{renderItem(item)}</div>)}</div>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

import { RemoteExecutionDrawer } from '@renderer/entries/automation/components/RemoteExecutionDrawer';

describe('RemoteExecutionDrawer', () => {
  it('renders execution status and logs', () => {
    render(
      <RemoteExecutionDrawer
        open
        runnerConnectionId="runner-local"
        execution={{
          id: 'exec-1',
          taskId: 'task-1',
          revisionId: 'rev-1',
          runnerId: 'runner-1',
          status: 'queued',
          triggeredBy: 'desktop',
          startedAt: null,
          finishedAt: null,
          cancelledBy: null,
          failureReason: null,
          currentStepId: 'step-1',
          retryCount: 0,
          resultSummary: null,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }}
        logs={[
          {
            id: 'log-1',
            executionId: 'exec-1',
            level: 'info',
            message: 'execution queued',
            stepId: null,
            timestamp: '2026-04-21T00:00:00.000Z',
          },
        ]}
        onRefresh={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('queued')).toBeDefined();
    expect(screen.getByText('execution queued')).toBeDefined();
  });

  it('calls cancel and refresh handlers', async () => {
    const onCancel = vi.fn(async () => undefined);
    const onRefresh = vi.fn(async () => undefined);

    render(
      <RemoteExecutionDrawer
        open
        runnerConnectionId="runner-local"
        execution={{
          id: 'exec-1',
          taskId: 'task-1',
          revisionId: 'rev-1',
          runnerId: 'runner-1',
          status: 'running',
          triggeredBy: 'desktop',
          startedAt: null,
          finishedAt: null,
          cancelledBy: null,
          failureReason: null,
          currentStepId: 'step-1',
          retryCount: 1,
          resultSummary: null,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }}
        logs={[]}
        onRefresh={onRefresh}
        onCancel={onCancel}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    fireEvent.click(screen.getByRole('button', { name: '取消执行' }));

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledWith('exec-1', 'runner-local');
    });
  });
});
