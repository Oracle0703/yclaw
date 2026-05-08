export type WorkspaceMemberRole = 'owner' | 'editor' | 'operator' | 'viewer';

export type WorkspaceMemberStatus = 'active' | 'disabled';

export interface WorkspaceRunnerPolicy {
  preferredRunnerKind?: 'local' | 'remote';
  requiredCapabilities?: string[];
}

export interface WorkspaceNotificationPolicy {
  alertAutoEscalateMinutes?: number;
  dutyOperatorMemberId?: string;
  escalationOwnerMemberId?: string;
}

export interface WorkspaceDutyPolicy {
  workspaceId: string;
  currentOperator?: {
    id: string;
    name: string;
  } | null;
  nextOperator?: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
  } | null;
  escalationOwner?: {
    id: string;
    name: string;
  } | null;
  alertAutoEscalateMinutes?: number;
}

export interface WorkspaceDutyShiftRecord {
  id: string;
  workspaceId: string;
  memberId: string;
  memberName?: string | null;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceDutyShiftInput {
  workspaceId: string;
  memberId: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  description?: string | null;
  defaultRunnerPolicy?: WorkspaceRunnerPolicy | null;
  notificationPolicy?: WorkspaceNotificationPolicy | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  name: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  defaultRunnerPolicy?: WorkspaceRunnerPolicy | null;
  notificationPolicy?: WorkspaceNotificationPolicy | null;
}

export type TaskRevisionReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface TaskRevisionRecord {
  id: string;
  taskId: string;
  version: string;
  snapshot: string;
  changeSummary?: string | null;
  reviewStatus: TaskRevisionReviewStatus;
  reviewer?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface PublishTaskRevisionInput {
  version: string;
  changeSummary?: string | null;
  createdBy?: string | null;
}

export interface ReviewTaskRevisionInput {
  action: 'approve' | 'reject';
  reviewer: string;
}

export type TaskRevisionChangeType = 'added' | 'updated' | 'removed';

export interface TaskRevisionChange {
  path: string;
  before?: unknown;
  after?: unknown;
  changeType: TaskRevisionChangeType;
}

export interface TaskRevisionComparison {
  baseRevisionId: string;
  targetRevisionId: string;
  changes: TaskRevisionChange[];
}

export type TaskReviewType = 'failure' | 'quality' | 'strategy';

export interface TaskReviewRecord {
  id: string;
  taskId: string;
  batchId?: string | null;
  reviewType: TaskReviewType;
  reasonCategory?: string | null;
  conclusion?: string | null;
  owner?: string | null;
  followUpActions: string[];
  linkedTemplateIds?: string[];
  createdAt: string;
}

export interface CreateTaskReviewInput {
  taskId: string;
  batchId?: string;
  reviewType: TaskReviewType;
  reasonCategory?: string;
  conclusion?: string;
  owner?: string;
  followUpActions?: string[];
}

export type TemplateBackflowDraftStatus = 'draft' | 'ready';

export type TemplateBackflowRiskLevel = 'low' | 'medium' | 'high';

export type TemplateBackflowChangeType =
  | 'selector-update'
  | 'field-update'
  | 'quality-rule'
  | 'checklist-update';

export interface TemplateBackflowProposedChange {
  type: TemplateBackflowChangeType;
  description: string;
}

export interface TemplateBackflowDraft {
  reviewId: string;
  templateId: string;
  title: string;
  status: TemplateBackflowDraftStatus;
  riskLevel: TemplateBackflowRiskLevel;
  proposedChanges: TemplateBackflowProposedChange[];
  executionSteps: string[];
  acceptanceCriteria: string[];
  sourceConclusion?: string | null;
  owner?: string | null;
}

export interface TemplateBackflowApplyResult {
  reviewId: string;
  templateId: string;
  appliedBy: string;
  appliedAt: string;
  appliedChanges: string[];
}

export type OperationsAcceptanceMetricKey =
  | 'taskSuccessRate'
  | 'alertClaimRate'
  | 'resultTraceabilityRate'
  | 'reviewBackflowRate';

export interface OperationsAcceptanceMetric {
  key: OperationsAcceptanceMetricKey;
  label: string;
  value: number;
  target: number;
  unit: 'ratio' | 'count';
  passed: boolean;
}

export type AlertActionType = 'claim' | 'assign' | 'note' | 'escalate' | 'close';

export interface AlertActionRecord {
  id: string;
  alertId: string;
  action: AlertActionType;
  operator?: string | null;
  note?: string | null;
  createdAt: string;
}
