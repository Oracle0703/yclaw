import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceService } from '@main/services/WorkspaceService';

const mockWorkspaceRepository = {
  createWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  upsertMember: vi.fn(),
  saveDutyShift: vi.fn(),
  listDutyShifts: vi.fn(),
  listMembers: vi.fn(),
  updateMemberRole: vi.fn(),
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspaceService({
      workspaceRepository: mockWorkspaceRepository,
    });
  });

  it('requires workspace repository injection', () => {
    expect(() => new WorkspaceService()).toThrow('workspaceRepository is required');
  });

  it('creates workspace with default runner policy', () => {
    mockWorkspaceRepository.createWorkspace.mockImplementationOnce((workspace) => workspace);

    const workspace = service.createWorkspace({
      name: '电商巡检组',
      description: '负责巡检任务',
      defaultRunnerPolicy: {
        preferredRunnerKind: 'remote',
        requiredCapabilities: ['browser-automation'],
      },
      notificationPolicy: {
        alertAutoEscalateMinutes: 10,
      },
    });

    expect(workspace.name).toBe('电商巡检组');
    expect(workspace.defaultRunnerPolicy?.preferredRunnerKind).toBe('remote');
    expect(mockWorkspaceRepository.createWorkspace).toHaveBeenCalledTimes(1);
  });

  it('updates member role and returns normalized member', () => {
    mockWorkspaceRepository.updateMemberRole.mockReturnValueOnce({
      id: 'member-1',
      workspaceId: 'workspace-1',
      name: 'Alice',
      role: 'operator',
      status: 'active',
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:01.000Z',
    });

    const member = service.updateMemberRole('workspace-1', 'member-1', 'operator');

    expect(member.role).toBe('operator');
    expect(mockWorkspaceRepository.updateMemberRole).toHaveBeenCalledWith(
      'workspace-1',
      'member-1',
      'operator',
    );
  });

  it('throws when updating a missing member role', () => {
    mockWorkspaceRepository.updateMemberRole.mockReturnValueOnce(null);

    expect(() => service.updateMemberRole('workspace-1', 'missing', 'operator')).toThrow(
      'Workspace member "missing" not found',
    );
  });

  it('resolves duty policy from notification policy and active members', () => {
    mockWorkspaceRepository.getWorkspace.mockReturnValueOnce({
      id: 'workspace-1',
      name: '电商巡检组',
      notificationPolicy: {
        alertAutoEscalateMinutes: 10,
        dutyOperatorMemberId: 'member-2',
        escalationOwnerMemberId: 'member-1',
      },
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });
    mockWorkspaceRepository.listMembers.mockReturnValueOnce([
      {
        id: 'member-1',
        workspaceId: 'workspace-1',
        name: 'Owner A',
        role: 'owner',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      {
        id: 'member-2',
        workspaceId: 'workspace-1',
        name: 'Operator B',
        role: 'operator',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);

    expect(service.resolveDutyPolicy('workspace-1')).toEqual({
      workspaceId: 'workspace-1',
      currentOperator: {
        id: 'member-2',
        name: 'Operator B',
      },
      nextOperator: null,
      escalationOwner: {
        id: 'member-1',
        name: 'Owner A',
      },
      alertAutoEscalateMinutes: 10,
    });
  });

  it('falls back to the first active operator and owner when duty policy is not configured', () => {
    mockWorkspaceRepository.getWorkspace.mockReturnValueOnce({
      id: 'workspace-1',
      name: '电商巡检组',
      notificationPolicy: {
        alertAutoEscalateMinutes: 15,
      },
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });
    mockWorkspaceRepository.listMembers.mockReturnValueOnce([
      {
        id: 'member-1',
        workspaceId: 'workspace-1',
        name: 'Owner A',
        role: 'owner',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      {
        id: 'member-2',
        workspaceId: 'workspace-1',
        name: 'Operator B',
        role: 'operator',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);

    expect(service.resolveDutyPolicy('workspace-1')).toMatchObject({
      currentOperator: {
        id: 'member-2',
        name: 'Operator B',
      },
      escalationOwner: {
        id: 'member-1',
        name: 'Owner A',
      },
      alertAutoEscalateMinutes: 15,
    });
  });

  it('prefers active duty shifts and exposes next operator in duty policy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T09:00:00.000Z'));
    mockWorkspaceRepository.getWorkspace.mockReturnValueOnce({
      id: 'workspace-1',
      name: '电商巡检组',
      notificationPolicy: {
        alertAutoEscalateMinutes: 15,
        escalationOwnerMemberId: 'member-1',
      },
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });
    mockWorkspaceRepository.listMembers.mockReturnValueOnce([
      {
        id: 'member-1',
        workspaceId: 'workspace-1',
        name: 'Owner A',
        role: 'owner',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      {
        id: 'member-2',
        workspaceId: 'workspace-1',
        name: 'Operator B',
        role: 'operator',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      {
        id: 'member-3',
        workspaceId: 'workspace-1',
        name: 'Operator C',
        role: 'operator',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);
    mockWorkspaceRepository.listDutyShifts.mockReturnValueOnce([
      {
        id: 'shift-1',
        workspaceId: 'workspace-1',
        memberId: 'member-2',
        memberName: 'Operator B',
        startsAt: '2026-04-22T08:00:00.000Z',
        endsAt: '2026-04-22T16:00:00.000Z',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      {
        id: 'shift-2',
        workspaceId: 'workspace-1',
        memberId: 'member-3',
        memberName: 'Operator C',
        startsAt: '2026-04-22T16:00:00.000Z',
        endsAt: '2026-04-23T00:00:00.000Z',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);

    expect(service.resolveDutyPolicy('workspace-1')).toEqual({
      workspaceId: 'workspace-1',
      currentOperator: {
        id: 'member-2',
        name: 'Operator B',
      },
      nextOperator: {
        id: 'member-3',
        name: 'Operator C',
        startsAt: '2026-04-22T16:00:00.000Z',
        endsAt: '2026-04-23T00:00:00.000Z',
      },
      escalationOwner: {
        id: 'member-1',
        name: 'Owner A',
      },
      alertAutoEscalateMinutes: 15,
    });
  });

  it('saves workspace duty shifts with normalized payload', () => {
    mockWorkspaceRepository.listMembers.mockReturnValueOnce([
      {
        id: 'member-2',
        workspaceId: 'workspace-1',
        name: 'Operator B',
        role: 'operator',
        status: 'active',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);

    const shift = service.saveDutyShift({
      workspaceId: 'workspace-1',
      memberId: 'member-2',
      startsAt: '2026-04-22T08:00:00.000Z',
      endsAt: '2026-04-22T16:00:00.000Z',
      notes: '白班',
    });

    expect(shift.workspaceId).toBe('workspace-1');
    expect(shift.memberId).toBe('member-2');
    expect(mockWorkspaceRepository.saveDutyShift).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        memberId: 'member-2',
        notes: '白班',
      }),
    );
  });
});
