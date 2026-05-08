import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  listAlertsMock,
  claimAlertMock,
  escalateAlertMock,
  closeAlertMock,
  assignAlertMock,
  addAlertNoteMock,
  listAlertActionsMock,
} = vi.hoisted(() => ({
  listAlertsMock: vi.fn(),
  claimAlertMock: vi.fn(),
  escalateAlertMock: vi.fn(),
  closeAlertMock: vi.fn(),
  assignAlertMock: vi.fn(),
  addAlertNoteMock: vi.fn(),
  listAlertActionsMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => <button type="button" onClick={onClick}>{children}</button>,
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

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    taskOperations: {
      listAlerts: listAlertsMock,
      claimAlert: claimAlertMock,
      escalateAlert: escalateAlertMock,
      closeAlert: closeAlertMock,
      assignAlert: assignAlertMock,
      addAlertNote: addAlertNoteMock,
      listAlertActions: listAlertActionsMock,
    },
  }),
}));

import { AlertInbox } from '@renderer/entries/automation/components/AlertInbox';

describe('AlertInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAlertsMock.mockResolvedValue([
      { id: 'alert-1', message: '任务失败', status: 'new', level: 'critical' },
    ]);
    claimAlertMock.mockResolvedValue({ id: 'alert-1', status: 'claimed' });
    escalateAlertMock.mockResolvedValue({ id: 'alert-1', status: 'escalated' });
    closeAlertMock.mockResolvedValue({ id: 'alert-1', status: 'closed' });
    assignAlertMock.mockResolvedValue({ id: 'alert-1', assignee: 'current-operator' });
    addAlertNoteMock.mockResolvedValue({ id: 'alert-1' });
    listAlertActionsMock.mockResolvedValue([
      {
        id: 'action-1',
        alertId: 'alert-1',
        action: 'note',
        operator: 'operator-b',
        note: '已检查日志',
        createdAt: '2026-04-21T08:05:00.000Z',
      },
    ]);
  });

  it('loads alerts and supports claim action', async () => {
    render(<AlertInbox />);

    expect(await screen.findByText('任务失败')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '认领' }));

    await waitFor(() => {
      expect(claimAlertMock).toHaveBeenCalledWith('alert-1');
    });
  });

  it('supports escalate and close actions', async () => {
    render(<AlertInbox />);

    expect(await screen.findByText('任务失败')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '升级' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    await waitFor(() => {
      expect(escalateAlertMock).toHaveBeenCalledWith('alert-1');
      expect(closeAlertMock).toHaveBeenCalledWith('alert-1');
    });
  });

  it('supports assign and note actions', async () => {
    render(<AlertInbox />);

    expect(await screen.findByText('任务失败')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '转交' }));
    fireEvent.click(screen.getByRole('button', { name: '备注' }));

    await waitFor(() => {
      expect(assignAlertMock).toHaveBeenCalledWith('alert-1');
      expect(addAlertNoteMock).toHaveBeenCalledWith('alert-1');
    });
  });

  it('loads and displays alert action history', async () => {
    render(<AlertInbox />);

    expect(await screen.findByText('已检查日志')).toBeDefined();
    expect(listAlertActionsMock).toHaveBeenCalledWith('alert-1');
  });
});
