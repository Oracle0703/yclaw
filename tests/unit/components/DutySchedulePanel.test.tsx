import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  listWorkspacesMock,
  listMembersMock,
  listWorkspaceDutyShiftsMock,
  saveWorkspaceDutyShiftMock,
  taskOperationsMock,
} = vi.hoisted(() => ({
  listWorkspacesMock: vi.fn(),
  listMembersMock: vi.fn(),
  listWorkspaceDutyShiftsMock: vi.fn(),
  saveWorkspaceDutyShiftMock: vi.fn(),
  taskOperationsMock: {
    listWorkspaces: vi.fn(),
    listMembers: vi.fn(),
    listWorkspaceDutyShifts: vi.fn(),
    saveWorkspaceDutyShift: vi.fn(),
  },
}));

vi.mock('antd', () => ({
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
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    taskOperations: taskOperationsMock,
  }),
}));

import { DutySchedulePanel } from '@renderer/entries/automation/components/DutySchedulePanel';

describe('DutySchedulePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    taskOperationsMock.listWorkspaces = listWorkspacesMock;
    taskOperationsMock.listMembers = listMembersMock;
    taskOperationsMock.listWorkspaceDutyShifts = listWorkspaceDutyShiftsMock;
    taskOperationsMock.saveWorkspaceDutyShift = saveWorkspaceDutyShiftMock;
    listWorkspacesMock.mockResolvedValue([{ id: 'workspace-1', name: '电商巡检组' }]);
    listMembersMock.mockResolvedValue([
      {
        id: 'member-2',
        workspaceId: 'workspace-1',
        name: 'Operator B',
        role: 'operator',
        status: 'active',
      },
    ]);
    listWorkspaceDutyShiftsMock.mockResolvedValue([
      {
        id: 'shift-1',
        workspaceId: 'workspace-1',
        memberId: 'member-2',
        memberName: 'Operator B',
        startsAt: '2026-04-22T08:00:00.000Z',
        endsAt: '2026-04-22T16:00:00.000Z',
        notes: '白班',
      },
    ]);
    saveWorkspaceDutyShiftMock.mockResolvedValue({
      id: 'shift-2',
      workspaceId: 'workspace-1',
      memberId: 'member-2',
      memberName: 'Operator B',
      startsAt: '2026-04-23T08:00:00.000Z',
      endsAt: '2026-04-23T16:00:00.000Z',
      notes: '自动排班',
    });
  });

  it('loads shifts and creates a quick next shift', async () => {
    render(<DutySchedulePanel />);

    expect(await screen.findByText('班次安排')).toBeDefined();
    expect(await screen.findByText('Operator B')).toBeDefined();
    expect(await screen.findByText('白班')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '新增班次' }));

    await waitFor(() => {
      expect(saveWorkspaceDutyShiftMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          memberId: 'member-2',
          notes: '自动排班',
        }),
      );
    });
    expect(await screen.findByText('自动排班')).toBeDefined();
  });
});
