import { randomUUID } from 'crypto';
import type {
  CreateWorkspaceDutyShiftInput,
  CreateWorkspaceInput,
  WorkspaceDutyPolicy,
  WorkspaceDutyShiftRecord,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceRecord,
} from '@shared/types';
import { WorkspaceRepository } from './repositories';

export interface WorkspaceServiceOptions {
  workspaceRepository?: Pick<
    WorkspaceRepository,
    | 'createWorkspace'
    | 'listWorkspaces'
    | 'getWorkspace'
    | 'updateWorkspace'
    | 'upsertMember'
    | 'saveDutyShift'
    | 'listDutyShifts'
    | 'listMembers'
    | 'updateMemberRole'
  >;
}

export class WorkspaceService {
  private readonly workspaceRepository: NonNullable<WorkspaceServiceOptions['workspaceRepository']>;

  constructor(options: WorkspaceServiceOptions = {}) {
    if (!options.workspaceRepository) {
      throw new Error('workspaceRepository is required');
    }

    this.workspaceRepository = options.workspaceRepository;
  }

  createWorkspace(input: CreateWorkspaceInput): WorkspaceRecord {
    const now = new Date().toISOString();
    const workspace: WorkspaceRecord = {
      id: randomUUID(),
      name: input.name.trim() || '未命名工作区',
      description: input.description,
      defaultRunnerPolicy: input.defaultRunnerPolicy ?? null,
      notificationPolicy: input.notificationPolicy ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.workspaceRepository.createWorkspace(workspace);

    return workspace;
  }

  listWorkspaces(): WorkspaceRecord[] {
    return this.workspaceRepository.listWorkspaces();
  }

  getWorkspace(workspaceId: string): WorkspaceRecord {
    const workspace = this.workspaceRepository.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace "${workspaceId}" not found`);
    }
    return workspace;
  }

  updateWorkspace(
    workspaceId: string,
    updates: Partial<
      Pick<WorkspaceRecord, 'name' | 'description' | 'defaultRunnerPolicy' | 'notificationPolicy'>
    >,
  ): WorkspaceRecord {
    const workspace = this.workspaceRepository.updateWorkspace(workspaceId, updates);
    if (!workspace) {
      throw new Error(`Workspace "${workspaceId}" not found`);
    }
    return workspace;
  }

  upsertMember(input: Omit<WorkspaceMember, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): WorkspaceMember {
    const now = new Date().toISOString();
    const member: WorkspaceMember = {
      id: input.id ?? randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name.trim() || '未命名成员',
      role: input.role,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    this.workspaceRepository.upsertMember(member);

    return member;
  }

  listMembers(workspaceId: string): WorkspaceMember[] {
    return this.workspaceRepository.listMembers(workspaceId);
  }

  listDutyShifts(workspaceId: string): WorkspaceDutyShiftRecord[] {
    return this.workspaceRepository.listDutyShifts(workspaceId);
  }

  updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceMemberRole,
  ): WorkspaceMember {
    const member = this.workspaceRepository.updateMemberRole(workspaceId, memberId, role);
    if (!member) {
      throw new Error(`Workspace member "${memberId}" not found`);
    }
    return member;
  }

  resolveDutyPolicy(workspaceId: string): WorkspaceDutyPolicy {
    const workspace = this.getWorkspace(workspaceId);
    const members = this.listMembers(workspaceId).filter((member) => member.status === 'active');
    const dutyShifts = (this.listDutyShifts(workspaceId) ?? []).filter((shift) =>
      members.some((member) => member.id === shift.memberId),
    );
    const notificationPolicy = workspace.notificationPolicy ?? {};
    const now = Date.now();
    const activeShift = dutyShifts.find((shift) =>
      new Date(shift.startsAt).getTime() <= now && new Date(shift.endsAt).getTime() > now,
    );
    const nextShift = dutyShifts.find((shift) => new Date(shift.startsAt).getTime() > now);
    const currentOperator = (activeShift
      ? members.find((member) => member.id === activeShift.memberId) ?? null
      : null)
      ?? findMemberById(members, notificationPolicy.dutyOperatorMemberId)
      ?? members.find((member) => member.role === 'operator')
      ?? null;
    const escalationOwner = findMemberById(members, notificationPolicy.escalationOwnerMemberId)
      ?? members.find((member) => member.role === 'owner')
      ?? null;

    return {
      workspaceId,
      currentOperator: currentOperator ? pickDutyMember(currentOperator) : null,
      nextOperator: nextShift ? pickNextDutyShift(nextShift) : null,
      escalationOwner: escalationOwner ? pickDutyMember(escalationOwner) : null,
      alertAutoEscalateMinutes: notificationPolicy.alertAutoEscalateMinutes,
    };
  }

  saveDutyShift(input: CreateWorkspaceDutyShiftInput): WorkspaceDutyShiftRecord {
    const member = this.listMembers(input.workspaceId).find((item) => item.id === input.memberId);
    if (!member) {
      throw new Error(`Workspace member "${input.memberId}" not found`);
    }
    if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
      throw new Error('Duty shift end time must be after start time');
    }

    const now = new Date().toISOString();
    const shift: WorkspaceDutyShiftRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      memberName: member.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.workspaceRepository.saveDutyShift(shift);
    return shift;
  }
}

function findMemberById(
  members: WorkspaceMember[],
  memberId: string | undefined,
): WorkspaceMember | null {
  if (!memberId) {
    return null;
  }

  return members.find((member) => member.id === memberId) ?? null;
}

function pickDutyMember(member: WorkspaceMember): { id: string; name: string } {
  return {
    id: member.id,
    name: member.name,
  };
}

function pickNextDutyShift(shift: WorkspaceDutyShiftRecord): {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
} {
  return {
    id: shift.memberId,
    name: shift.memberName ?? '未命名成员',
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  };
}
