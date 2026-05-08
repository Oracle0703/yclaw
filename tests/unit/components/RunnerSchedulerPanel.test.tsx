import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, messageErrorMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
}));

vi.mock('@renderer/shared/hooks', () => ({ useIpc: () => ({ invoke: invokeMock }) }));
vi.mock('antd', () => ({
  Card: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  List: ({
    dataSource,
    renderItem,
  }: {
    dataSource?: unknown[];
    renderItem: (item: unknown) => React.ReactNode;
  }) => <div>{(dataSource ?? []).map((item, index) => <div key={index}>{renderItem(item)}</div>)}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
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
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  message: {
    error: messageErrorMock,
  },
}));

import { RunnerSchedulerPanel } from '@renderer/entries/automation/components/RunnerSchedulerPanel';

function createRunner(name: string) {
  return {
    id: `runner-${name}`,
    name,
    kind: 'local',
    status: 'online',
    runningCount: 1,
    maxConcurrency: 4,
    recentFailureRate: 0,
  };
}

function createQueueItem(taskType: 'collect' | 'inspect' | 'replay') {
  return { id: `queue-${taskType}`, taskType };
}

function createLease(status: 'active' | 'orphaned' | 'released') {
  return { id: `lease-${status}`, status };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('RunnerSchedulerPanel', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    messageErrorMock.mockReset();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        return [createRunner('Local Runner')];
      }
      if (channel === 'runner:queue:list') {
        return [
          createQueueItem('collect'),
          createQueueItem('inspect'),
          createQueueItem('replay'),
        ];
      }
      if (channel === 'runner:lease:list') {
        return [createLease('active'), createLease('orphaned'), createLease('released')];
      }
      return null;
    });
  });

  it('renders runner pool status with queue and lease counters', async () => {
    render(<RunnerSchedulerPanel />);

    expect(await screen.findByText('Local Runner')).toBeDefined();
    expect(await screen.findByText('online')).toBeDefined();
    expect(await screen.findByText('collect: 1')).toBeDefined();
    expect(await screen.findByText('inspect: 1')).toBeDefined();
    expect(await screen.findByText('replay: 1')).toBeDefined();
    expect(await screen.findByText('2 active / orphaned leases')).toBeDefined();
  });

  it('refreshes pool status when clicking 刷新', async () => {
    let runnerName = 'Runner A';
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        return [createRunner(runnerName)];
      }
      if (channel === 'runner:queue:list' || channel === 'runner:lease:list') return [];
      return null;
    });

    render(<RunnerSchedulerPanel />);
    expect(await screen.findByText('Runner A')).toBeDefined();

    runnerName = 'Runner B';
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    expect(await screen.findByText('Runner B')).toBeDefined();
  });

  it('dispatches once and refreshes view', async () => {
    let runnerName = 'Before Dispatch';
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        return [createRunner(runnerName)];
      }
      if (channel === 'runner:queue:list' || channel === 'runner:lease:list') return [];
      if (channel === 'runner:dispatch:tick') {
        runnerName = 'After Dispatch';
        return null;
      }
      return null;
    });

    render(<RunnerSchedulerPanel />);
    expect(await screen.findByText('Before Dispatch')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '调度一次' }));

    expect(await screen.findByText('After Dispatch')).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith('runner:dispatch:tick');
  });

  it('reconciles leases and refreshes view', async () => {
    let leases = [createLease('active')];
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        return [createRunner('Runner')];
      }
      if (channel === 'runner:queue:list') return [];
      if (channel === 'runner:lease:list') return leases;
      if (channel === 'runner:lease:reconcile') {
        leases = [createLease('active'), createLease('orphaned')];
      }
      return null;
    });

    render(<RunnerSchedulerPanel />);
    expect(await screen.findByText('1 active / orphaned leases')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '恢复检查' }));

    expect(await screen.findByText('2 active / orphaned leases')).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith('runner:lease:reconcile');
  });

  it('ignores stale refresh responses and keeps latest result', async () => {
    const firstRunners = createDeferred<unknown[]>();
    const firstQueue = createDeferred<unknown[]>();
    const firstLeases = createDeferred<unknown[]>();
    let runnerListCall = 0;
    let queueListCall = 0;
    let leaseListCall = 0;

    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        runnerListCall += 1;
        if (runnerListCall === 1) return firstRunners.promise;
        return [createRunner('Fresh Runner')];
      }
      if (channel === 'runner:queue:list') {
        queueListCall += 1;
        if (queueListCall === 1) return firstQueue.promise;
        return [];
      }
      if (channel === 'runner:lease:list') {
        leaseListCall += 1;
        if (leaseListCall === 1) return firstLeases.promise;
        return [];
      }
      return null;
    });

    render(<RunnerSchedulerPanel />);

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    expect(await screen.findByText('Fresh Runner')).toBeDefined();

    firstRunners.resolve([createRunner('Stale Runner')]);
    firstQueue.resolve([]);
    firstLeases.resolve([]);

    await waitFor(() => {
      expect(screen.queryByText('Stale Runner')).toBeNull();
    });
    expect(screen.getByText('Fresh Runner')).toBeDefined();
  });

  it('reports refresh failures without unhandled rejection', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        throw new Error('refresh failed');
      }
      if (channel === 'runner:queue:list' || channel === 'runner:lease:list') return [];
      return null;
    });

    render(<RunnerSchedulerPanel />);

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('refresh failed');
    });
  });

  it('reports dispatch failures and does not throw unhandled errors', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        return [createRunner('Runner')];
      }
      if (channel === 'runner:queue:list' || channel === 'runner:lease:list') return [];
      if (channel === 'runner:dispatch:tick') {
        throw new Error('dispatch failed');
      }
      return null;
    });

    render(<RunnerSchedulerPanel />);
    await screen.findByText('Runner');

    fireEvent.click(screen.getByRole('button', { name: '调度一次' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('dispatch failed');
    });
  });

  it('reports reconcile failures and does not throw unhandled errors', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'runner:registry:list') {
        return [createRunner('Runner')];
      }
      if (channel === 'runner:queue:list' || channel === 'runner:lease:list') return [];
      if (channel === 'runner:lease:reconcile') {
        throw new Error('reconcile failed');
      }
      return null;
    });

    render(<RunnerSchedulerPanel />);
    await screen.findByText('Runner');

    fireEvent.click(screen.getByRole('button', { name: '恢复检查' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('reconcile failed');
    });
  });
});
