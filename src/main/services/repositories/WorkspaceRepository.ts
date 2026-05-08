import Database from 'better-sqlite3';
import type {
  WorkspaceDutyShiftRecord,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceRecord,
} from '@shared/types';

interface WorkspaceRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface WorkspaceRow {
  id: string;
  name: string;
  description?: string | null;
  default_runner_policy?: string | null;
  notification_policy?: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  name: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMember['status'];
  created_at: string;
  updated_at: string;
}

interface WorkspaceDutyShiftRow {
  id: string;
  workspace_id: string;
  member_id: string;
  member_name?: string | null;
  starts_at: string;
  ends_at: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

type WorkspaceRepositoryInput = WorkspaceRepositoryExecutor | Database.Database;

export class WorkspaceRepository {
  private readonly executor: WorkspaceRepositoryExecutor;

  constructor(executor: WorkspaceRepositoryInput) {
    this.executor = toExecutor(executor);
  }

  createWorkspace(workspace: WorkspaceRecord): void {
    this.executor.run(
      `INSERT INTO workspaces (
        id, name, description, default_runner_policy, notification_policy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        workspace.id,
        workspace.name,
        workspace.description ?? null,
        stringifyJson(workspace.defaultRunnerPolicy ?? null),
        stringifyJson(workspace.notificationPolicy ?? null),
        workspace.createdAt,
        workspace.updatedAt,
      ],
    );
  }

  listWorkspaces(): WorkspaceRecord[] {
    return this.executor
      .all<WorkspaceRow>(
        `SELECT id, name, description, default_runner_policy, notification_policy, created_at, updated_at
         FROM workspaces
         ORDER BY created_at ASC`,
      )
      .map(mapWorkspaceRow);
  }

  getWorkspace(workspaceId: string): WorkspaceRecord | null {
    const row = this.executor.get<WorkspaceRow>(
      `SELECT id, name, description, default_runner_policy, notification_policy, created_at, updated_at
       FROM workspaces
       WHERE id = ?`,
      [workspaceId],
    );

    return row ? mapWorkspaceRow(row) : null;
  }

  updateWorkspace(
    workspaceId: string,
    updates: Partial<
      Pick<WorkspaceRecord, 'name' | 'description' | 'defaultRunnerPolicy' | 'notificationPolicy'>
    >,
  ): WorkspaceRecord | null {
    const assignments: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      assignments.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      assignments.push('description = ?');
      params.push(updates.description ?? null);
    }
    if (updates.defaultRunnerPolicy !== undefined) {
      assignments.push('default_runner_policy = ?');
      params.push(stringifyJson(updates.defaultRunnerPolicy ?? null));
    }
    if (updates.notificationPolicy !== undefined) {
      assignments.push('notification_policy = ?');
      params.push(stringifyJson(updates.notificationPolicy ?? null));
    }

    if (assignments.length === 0) {
      return this.getWorkspace(workspaceId);
    }

    params.push(workspaceId);
    this.executor.run(
      `UPDATE workspaces
       SET ${assignments.join(', ')}, updated_at = datetime('now')
       WHERE id = ?`,
      params,
    );

    return this.getWorkspace(workspaceId);
  }

  upsertMember(member: WorkspaceMember): void {
    this.executor.run(
      `INSERT INTO workspace_members (
        id, workspace_id, name, role, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        name = excluded.name,
        role = excluded.role,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        member.id,
        member.workspaceId,
        member.name,
        member.role,
        member.status,
        member.createdAt,
        member.updatedAt,
      ],
    );
  }

  listMembers(workspaceId: string): WorkspaceMember[] {
    return this.executor
      .all<WorkspaceMemberRow>(
        `SELECT id, workspace_id, name, role, status, created_at, updated_at
         FROM workspace_members
         WHERE workspace_id = ?
         ORDER BY created_at ASC`,
        [workspaceId],
      )
      .map(mapMemberRow);
  }

  updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceMemberRole,
  ): WorkspaceMember | null {
    this.executor.run(
      `UPDATE workspace_members
       SET role = ?, updated_at = datetime('now')
       WHERE workspace_id = ? AND id = ?`,
      [role, workspaceId, memberId],
    );

    const row = this.executor.get<WorkspaceMemberRow>(
      `SELECT id, workspace_id, name, role, status, created_at, updated_at
       FROM workspace_members
       WHERE workspace_id = ? AND id = ?`,
      [workspaceId, memberId],
    );

    return row ? mapMemberRow(row) : null;
  }

  saveDutyShift(shift: WorkspaceDutyShiftRecord): void {
    this.executor.run(
      `INSERT INTO workspace_duty_shifts (
        id, workspace_id, member_id, starts_at, ends_at, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        member_id = excluded.member_id,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      [
        shift.id,
        shift.workspaceId,
        shift.memberId,
        shift.startsAt,
        shift.endsAt,
        shift.notes ?? null,
        shift.createdAt,
        shift.updatedAt,
      ],
    );
  }

  listDutyShifts(workspaceId: string): WorkspaceDutyShiftRecord[] {
    return this.executor
      .all<WorkspaceDutyShiftRow>(
        `SELECT
           shifts.id,
           shifts.workspace_id,
           shifts.member_id,
           members.name AS member_name,
           shifts.starts_at,
           shifts.ends_at,
           shifts.notes,
           shifts.created_at,
           shifts.updated_at
         FROM workspace_duty_shifts shifts
         LEFT JOIN workspace_members members
           ON members.id = shifts.member_id
         WHERE shifts.workspace_id = ?
         ORDER BY shifts.starts_at ASC`,
        [workspaceId],
      )
      .map(mapDutyShiftRow);
  }
}

function mapWorkspaceRow(row: WorkspaceRow): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    defaultRunnerPolicy: parseJson(row.default_runner_policy, null),
    notificationPolicy: parseJson(row.notification_policy, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMemberRow(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDutyShiftRow(row: WorkspaceDutyShiftRow): WorkspaceDutyShiftRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    memberId: row.member_id,
    memberName: row.member_name ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stringifyJson(value: unknown): string | null {
  return value == null ? null : JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isExecutor(input: WorkspaceRepositoryInput): input is WorkspaceRepositoryExecutor {
  return typeof (input as WorkspaceRepositoryExecutor).all === 'function'
    && typeof (input as WorkspaceRepositoryExecutor).get === 'function'
    && typeof (input as WorkspaceRepositoryExecutor).run === 'function';
}

function toExecutor(input: WorkspaceRepositoryInput): WorkspaceRepositoryExecutor {
  if (isExecutor(input)) {
    return input;
  }

  return {
    all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      const statement = input.prepare(sql);
      return (params ? statement.all(...params) : statement.all()) as T[];
    },
    get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
      const statement = input.prepare(sql);
      return (params ? statement.get(...params) : statement.get()) as T | undefined;
    },
    run(sql: string, params?: unknown[]): { changes?: number } {
      const statement = input.prepare(sql);
      return params ? statement.run(...params) : statement.run();
    },
  };
}
