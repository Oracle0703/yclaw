import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const { listWorkspacesMock, getWorkspaceDutyMock } = vi.hoisted(() => ({
  listWorkspacesMock: vi.fn(),
  getWorkspaceDutyMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Select: ({
    value,
    options,
  }: {
    value?: string;
    options?: Array<{ label: string; value: string }>;
  }) => (
    <select aria-label="工作区切换" value={value}>
      {(options ?? []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    taskOperations: {
      listWorkspaces: listWorkspacesMock,
      getWorkspaceDuty: getWorkspaceDutyMock,
    },
  }),
}));

import { WorkspaceSwitcher } from '@renderer/entries/automation/components/WorkspaceSwitcher';

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkspacesMock.mockResolvedValue([
      { id: 'workspace-1', name: '电商巡检组' },
      { id: 'workspace-2', name: '表单提报组' },
    ]);
    getWorkspaceDutyMock.mockResolvedValue({
      workspaceId: 'workspace-1',
      currentOperator: { id: 'member-2', name: 'Operator B' },
      nextOperator: {
        id: 'member-3',
        name: 'Operator C',
        startsAt: '2026-04-22T16:00:00.000Z',
        endsAt: '2026-04-23T00:00:00.000Z',
      },
      escalationOwner: { id: 'member-1', name: 'Owner A' },
      alertAutoEscalateMinutes: 10,
    });
  });

  it('loads and renders workspace options', async () => {
    render(<WorkspaceSwitcher />);

    await waitFor(() => {
      expect(listWorkspacesMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('工作区')).toBeDefined();
    expect(await screen.findByText('电商巡检组')).toBeDefined();
    expect(await screen.findByText('当前值班：Operator B')).toBeDefined();
    expect(await screen.findByText('下一班：Operator C')).toBeDefined();
    expect(getWorkspaceDutyMock).toHaveBeenCalledWith('workspace-1');
  });
});
