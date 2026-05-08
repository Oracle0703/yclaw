import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRepository } from '@main/services/repositories/WorkspaceRepository';

function createExecutor() {
  return {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
  };
}

describe('WorkspaceRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: WorkspaceRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new WorkspaceRepository(executor);
  });

  it('creates and lists workspaces with JSON policies', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'workspace-1',
        name: '电商巡检组',
        description: '负责巡检任务',
        default_runner_policy: JSON.stringify({
          preferredRunnerKind: 'remote',
          requiredCapabilities: ['browser-automation'],
        }),
        notification_policy: JSON.stringify({
          alertAutoEscalateMinutes: 10,
          dutyOperatorMemberId: 'member-2',
          escalationOwnerMemberId: 'member-1',
        }),
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
      },
    ]);

    repository.createWorkspace({
      id: 'workspace-1',
      name: '电商巡检组',
      description: '负责巡检任务',
      defaultRunnerPolicy: {
        preferredRunnerKind: 'remote',
        requiredCapabilities: ['browser-automation'],
      },
      notificationPolicy: {
        alertAutoEscalateMinutes: 10,
        dutyOperatorMemberId: 'member-2',
        escalationOwnerMemberId: 'member-1',
      },
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(repository.listWorkspaces()).toEqual([
      {
        id: 'workspace-1',
        name: '电商巡检组',
        description: '负责巡检任务',
        defaultRunnerPolicy: {
          preferredRunnerKind: 'remote',
          requiredCapabilities: ['browser-automation'],
        },
        notificationPolicy: {
          alertAutoEscalateMinutes: 10,
          dutyOperatorMemberId: 'member-2',
          escalationOwnerMemberId: 'member-1',
        },
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);
    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workspaces'),
      [
        'workspace-1',
        '电商巡检组',
        '负责巡检任务',
        JSON.stringify({
          preferredRunnerKind: 'remote',
          requiredCapabilities: ['browser-automation'],
        }),
        JSON.stringify({
          alertAutoEscalateMinutes: 10,
          dutyOperatorMemberId: 'member-2',
          escalationOwnerMemberId: 'member-1',
        }),
        '2026-04-21T00:00:00.000Z',
        '2026-04-21T00:00:00.000Z',
      ],
    );
  });

  it('upserts members and updates their role', () => {
    executor.get.mockReturnValueOnce({
      id: 'member-1',
      workspace_id: 'workspace-1',
      name: 'Alice',
      role: 'operator',
      status: 'active',
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:01.000Z',
    });
    executor.all.mockReturnValueOnce([
      {
        id: 'member-1',
        workspace_id: 'workspace-1',
        name: 'Alice',
        role: 'operator',
        status: 'active',
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:01.000Z',
      },
    ]);

    repository.upsertMember({
      id: 'member-1',
      workspaceId: 'workspace-1',
      name: 'Alice',
      role: 'editor',
      status: 'active',
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });
    const updated = repository.updateMemberRole('workspace-1', 'member-1', 'operator');

    expect(updated?.role).toBe('operator');
    expect(repository.listMembers('workspace-1')).toEqual([
      {
        id: 'member-1',
        workspaceId: 'workspace-1',
        name: 'Alice',
        role: 'operator',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:01.000Z',
      },
    ]);
    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO workspace_members'),
      [
        'member-1',
        'workspace-1',
        'Alice',
        'editor',
        'active',
        '2026-04-21T00:00:00.000Z',
        '2026-04-21T00:00:00.000Z',
      ],
    );
  });

  it('saves and lists workspace duty shifts with member names', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'shift-1',
        workspace_id: 'workspace-1',
        member_id: 'member-2',
        member_name: 'Operator B',
        starts_at: '2026-04-22T08:00:00.000Z',
        ends_at: '2026-04-22T16:00:00.000Z',
        notes: '白班',
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
      },
    ]);

    repository.saveDutyShift({
      id: 'shift-1',
      workspaceId: 'workspace-1',
      memberId: 'member-2',
      startsAt: '2026-04-22T08:00:00.000Z',
      endsAt: '2026-04-22T16:00:00.000Z',
      notes: '白班',
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(repository.listDutyShifts('workspace-1')).toEqual([
      {
        id: 'shift-1',
        workspaceId: 'workspace-1',
        memberId: 'member-2',
        memberName: 'Operator B',
        startsAt: '2026-04-22T08:00:00.000Z',
        endsAt: '2026-04-22T16:00:00.000Z',
        notes: '白班',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);
    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO workspace_duty_shifts'),
      [
        'shift-1',
        'workspace-1',
        'member-2',
        '2026-04-22T08:00:00.000Z',
        '2026-04-22T16:00:00.000Z',
        '白班',
        '2026-04-21T00:00:00.000Z',
        '2026-04-21T00:00:00.000Z',
      ],
    );
  });
});
