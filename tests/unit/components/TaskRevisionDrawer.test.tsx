import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { listTaskRevisionsMock, publishTaskRevisionMock, compareTaskRevisionsMock } = vi.hoisted(() => ({
  listTaskRevisionsMock: vi.fn(),
  publishTaskRevisionMock: vi.fn(),
  compareTaskRevisionsMock: vi.fn(),
}));

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

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    taskOperations: {
      listTaskRevisions: listTaskRevisionsMock,
      publishTaskRevision: publishTaskRevisionMock,
      compareTaskRevisions: compareTaskRevisionsMock,
    },
  }),
}));

import { TaskRevisionDrawer } from '@renderer/entries/automation/components/TaskRevisionDrawer';

describe('TaskRevisionDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTaskRevisionsMock.mockResolvedValue([
      { id: 'revision-2', version: 'v2', reviewStatus: 'pending' },
      { id: 'revision-1', version: 'v1', reviewStatus: 'approved' },
    ]);
    publishTaskRevisionMock.mockResolvedValue({ id: 'revision-2', version: 'v2' });
    compareTaskRevisionsMock.mockResolvedValue({
      baseRevisionId: 'revision-1',
      targetRevisionId: 'revision-2',
      changes: [
        { path: 'name', before: '旧任务', after: '新任务', changeType: 'updated' },
      ],
    });
  });

  it('loads revisions when opened with a task id', async () => {
    render(<TaskRevisionDrawer taskId="task-1" open />);

    await waitFor(() => {
      expect(listTaskRevisionsMock).toHaveBeenCalledWith('task-1');
    });
    expect(await screen.findByText('任务版本')).toBeDefined();
    expect(await screen.findByText('v1')).toBeDefined();
  });

  it('publishes a new revision from the drawer', async () => {
    render(<TaskRevisionDrawer taskId="task-1" open />);

    fireEvent.click(await screen.findByRole('button', { name: '发布当前版本' }));

    await waitFor(() => {
      expect(publishTaskRevisionMock).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1' }),
      );
    });
  });

  it('compares latest revision with previous revision', async () => {
    render(<TaskRevisionDrawer taskId="task-1" open />);

    expect(await screen.findByText('v2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '对比前一版' }));

    expect(await screen.findByText('name：旧任务 → 新任务')).toBeDefined();
    expect(compareTaskRevisionsMock).toHaveBeenCalledWith({
      baseRevisionId: 'revision-1',
      targetRevisionId: 'revision-2',
    });
  });
});
