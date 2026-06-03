import { IPC_CHANNELS } from '@shared/constants';
import type {
  TemplateBackflowChangeType,
  TemplateBackflowDraft,
  TemplateBackflowDraftStatus,
  TemplateBackflowRiskLevel,
} from '@shared/types';

interface IpcControllerLike {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
}

interface WorkspaceServiceLike {
  listWorkspaces(): unknown;
  createWorkspace(payload: unknown): unknown;
  updateWorkspace(workspaceId: string, updates: unknown): unknown;
  resolveDutyPolicy(workspaceId: string): unknown;
  listDutyShifts(workspaceId: string): unknown;
  saveDutyShift(payload: unknown): unknown;
  listMembers(workspaceId: string): unknown;
  updateMemberRole(workspaceId: string, memberId: string, role: string): unknown;
}

interface TaskRevisionServiceLike {
  listRevisions(taskId: string): unknown;
  publishRevision(taskId: string, payload: unknown): unknown;
  reviewRevision(revisionId: string, payload: unknown): unknown;
  compareRevisions(baseRevisionId: string, targetRevisionId: string): unknown;
}

interface ReviewServiceLike {
  listReviews(query: unknown): unknown;
  createReview(payload: unknown): unknown;
  suggestTemplateBackflow(reviewId: string, templateId: string): unknown;
  createTemplateBackflowDraft(reviewId: string, templateId: string): unknown;
}

interface AlertServiceLike {
  claimAlert(alertId: string, assignee: string): unknown;
  assignAlert(alertId: string, assignee: string, operator: string, note?: string): unknown;
  addAlertNote(alertId: string, operator: string, note: string): unknown;
  listAlertActions(alertId: string): unknown;
  escalateAlert(alertId: string, operator: string, note?: string): unknown;
  closeAlert(alertId: string, resolution: string, operator: string): unknown;
}

interface TemplateServiceLike {
  linkReview(reviewId: string, templateId: string): unknown;
  applyTemplateBackflowDraft(draft: TemplateBackflowDraft, appliedBy?: string): unknown;
}

interface ResultServiceLike {
  analyzeCrossBatchQuality(taskId: string, rule?: unknown): unknown;
}

interface OperationsMetricsServiceLike {
  buildAcceptanceMetrics(taskId?: string): unknown;
}

export function registerTaskOperationsHandlers(options: {
  ipcController: IpcControllerLike;
  workspaceService: WorkspaceServiceLike;
  taskRevisionService: TaskRevisionServiceLike;
  reviewService?: ReviewServiceLike;
  alertService?: AlertServiceLike;
  templateService?: TemplateServiceLike;
  resultService?: ResultServiceLike;
  operationsMetricsService?: OperationsMetricsServiceLike;
}): void {
  const {
    ipcController,
    workspaceService,
    taskRevisionService,
    reviewService,
    alertService,
    templateService,
    resultService,
    operationsMetricsService,
  } = options;

  ipcController.handle(IPC_CHANNELS.WORKSPACE_LIST, () => workspaceService.listWorkspaces());
  ipcController.handle(IPC_CHANNELS.WORKSPACE_CREATE, (payload) =>
    workspaceService.createWorkspace(payload),
  );
  ipcController.handle(IPC_CHANNELS.WORKSPACE_UPDATE, (payload) => {
    const body = assertObject(payload);
    return workspaceService.updateWorkspace(assertString(body.workspaceId, 'workspaceId'), body.updates);
  });
  ipcController.handle(IPC_CHANNELS.WORKSPACE_DUTY_GET, (payload) => {
    const body = assertObject(payload);
    return workspaceService.resolveDutyPolicy(assertString(body.workspaceId, 'workspaceId'));
  });
  ipcController.handle(IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_LIST, (payload) => {
    const body = assertObject(payload);
    return workspaceService.listDutyShifts(assertString(body.workspaceId, 'workspaceId'));
  });
  ipcController.handle(IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_SAVE, (payload) => {
    const body = assertObject(payload);
    return workspaceService.saveDutyShift(body);
  });
  ipcController.handle(IPC_CHANNELS.WORKSPACE_MEMBER_LIST, (payload) => {
    const body = assertObject(payload);
    return workspaceService.listMembers(assertString(body.workspaceId, 'workspaceId'));
  });
  ipcController.handle(IPC_CHANNELS.WORKSPACE_MEMBER_UPDATE_ROLE, (payload) => {
    const body = assertObject(payload);
    return workspaceService.updateMemberRole(
      assertString(body.workspaceId, 'workspaceId'),
      assertString(body.memberId, 'memberId'),
      assertString(body.role, 'role'),
    );
  });

  ipcController.handle(IPC_CHANNELS.TASK_REVISION_LIST, (payload) => {
    const body = assertObject(payload);
    return taskRevisionService.listRevisions(assertString(body.taskId, 'taskId'));
  });
  ipcController.handle(IPC_CHANNELS.TASK_REVISION_PUBLISH, (payload) => {
    const body = assertObject(payload);
    return taskRevisionService.publishRevision(assertString(body.taskId, 'taskId'), body);
  });
  ipcController.handle(IPC_CHANNELS.TASK_REVISION_REVIEW, (payload) => {
    const body = assertObject(payload);
    return taskRevisionService.reviewRevision(assertString(body.revisionId, 'revisionId'), body);
  });
  ipcController.handle(IPC_CHANNELS.TASK_REVISION_COMPARE, (payload) => {
    const body = assertObject(payload);
    return taskRevisionService.compareRevisions(
      assertString(body.baseRevisionId, 'baseRevisionId'),
      assertString(body.targetRevisionId, 'targetRevisionId'),
    );
  });

  if (reviewService) {
    ipcController.handle(IPC_CHANNELS.REVIEW_LIST, (payload) => {
      const body = payload == null ? {} : assertObject(payload);
      return reviewService.listReviews(body);
    });
    ipcController.handle(IPC_CHANNELS.REVIEW_CREATE, (payload) => {
      const body = assertObject(payload);
      return reviewService.createReview(body);
    });
    ipcController.handle(IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_SUGGEST, (payload) => {
      const body = assertObject(payload);
      return reviewService.suggestTemplateBackflow(
        assertString(body.reviewId, 'reviewId'),
        assertString(body.templateId, 'templateId'),
      );
    });
    ipcController.handle(IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_DRAFT, (payload) => {
      const body = assertObject(payload);
      return reviewService.createTemplateBackflowDraft(
        assertString(body.reviewId, 'reviewId'),
        assertString(body.templateId, 'templateId'),
      );
    });
  }

  if (alertService) {
    ipcController.handle(IPC_CHANNELS.ALERT_CLAIM, (payload) => {
      const body = assertObject(payload);
      const assignee = typeof body.assignee === 'string' && body.assignee.length > 0
        ? body.assignee
        : 'current-operator';
      return alertService.claimAlert(assertString(body.alertId, 'alertId'), assignee);
    });
    ipcController.handle(IPC_CHANNELS.ALERT_ASSIGN, (payload) => {
      const body = assertObject(payload);
      const assignee = assertString(body.assignee, 'assignee');
      const operator = typeof body.operator === 'string' && body.operator.length > 0
        ? body.operator
        : 'current-operator';
      const note = typeof body.note === 'string' ? body.note : undefined;
      return alertService.assignAlert(assertString(body.alertId, 'alertId'), assignee, operator, note);
    });
    ipcController.handle(IPC_CHANNELS.ALERT_NOTE, (payload) => {
      const body = assertObject(payload);
      const operator = typeof body.operator === 'string' && body.operator.length > 0
        ? body.operator
        : 'current-operator';
      return alertService.addAlertNote(
        assertString(body.alertId, 'alertId'),
        operator,
        assertString(body.note, 'note'),
      );
    });
    ipcController.handle(IPC_CHANNELS.ALERT_ACTION_LIST, (payload) => {
      const body = assertObject(payload);
      return alertService.listAlertActions(assertString(body.alertId, 'alertId'));
    });
    ipcController.handle(IPC_CHANNELS.ALERT_ESCALATE, (payload) => {
      const body = assertObject(payload);
      const operator = typeof body.operator === 'string' && body.operator.length > 0
        ? body.operator
        : 'current-operator';
      const note = typeof body.note === 'string' ? body.note : undefined;
      return alertService.escalateAlert(assertString(body.alertId, 'alertId'), operator, note);
    });
    ipcController.handle(IPC_CHANNELS.ALERT_CLOSE, (payload) => {
      const body = assertObject(payload);
      const operator = typeof body.operator === 'string' && body.operator.length > 0
        ? body.operator
        : 'current-operator';
      const resolution = typeof body.resolution === 'string' && body.resolution.length > 0
        ? body.resolution
        : '已关闭';
      return alertService.closeAlert(assertString(body.alertId, 'alertId'), resolution, operator);
    });
  }

  if (templateService) {
    ipcController.handle(IPC_CHANNELS.TEMPLATE_LINK_REVIEW, (payload) => {
      const body = assertObject(payload);
      return templateService.linkReview(
        assertString(body.reviewId, 'reviewId'),
        assertString(body.templateId, 'templateId'),
      );
    });
    ipcController.handle(IPC_CHANNELS.TEMPLATE_BACKFLOW_APPLY, (payload) => {
      const body = assertObject(payload);
      const draft = assertTemplateBackflowDraft(body.draft);
      const appliedBy = typeof body.appliedBy === 'string' && body.appliedBy.length > 0
        ? body.appliedBy
        : undefined;
      return templateService.applyTemplateBackflowDraft(draft, appliedBy);
    });
  }

  if (resultService) {
    ipcController.handle(IPC_CHANNELS.RESULT_QUALITY_ANALYZE, (payload) => {
      const body = assertObject(payload);
      return resultService.analyzeCrossBatchQuality(
        assertString(body.taskId, 'taskId'),
        body.rule,
      );
    });
  }

  if (operationsMetricsService) {
    ipcController.handle(IPC_CHANNELS.OPS_ACCEPTANCE_METRICS, (payload) => {
      const body = payload == null ? {} : assertObject(payload);
      const taskId = typeof body.taskId === 'string' && body.taskId.length > 0
        ? body.taskId
        : undefined;
      return operationsMetricsService.buildAcceptanceMetrics(taskId);
    });
  }
}

function assertObject(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('payload object is required');
  }
  return payload as Record<string, unknown>;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function assertTemplateBackflowDraft(value: unknown): TemplateBackflowDraft {
  const body = assertObject(value);
  return {
    reviewId: assertString(body.reviewId, 'reviewId'),
    templateId: assertString(body.templateId, 'templateId'),
    title: assertString(body.title, 'title'),
    status: assertTemplateBackflowDraftStatus(body.status),
    riskLevel: assertTemplateBackflowRiskLevel(body.riskLevel),
    proposedChanges: assertTemplateBackflowProposedChanges(body.proposedChanges),
    executionSteps: assertStringArray(body.executionSteps, 'executionSteps'),
    acceptanceCriteria: assertStringArray(body.acceptanceCriteria, 'acceptanceCriteria'),
    sourceConclusion:
      typeof body.sourceConclusion === 'string' || body.sourceConclusion === null
        ? body.sourceConclusion
        : undefined,
    owner: typeof body.owner === 'string' ? body.owner : undefined,
  };
}

function assertTemplateBackflowDraftStatus(value: unknown): TemplateBackflowDraftStatus {
  if (value === 'draft' || value === 'ready') {
    return value;
  }
  throw new Error('status is required');
}

function assertTemplateBackflowRiskLevel(value: unknown): TemplateBackflowRiskLevel {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  throw new Error('riskLevel is required');
}

function assertTemplateBackflowChangeType(value: unknown): TemplateBackflowChangeType {
  if (
    value === 'selector-update'
    || value === 'field-update'
    || value === 'quality-rule'
    || value === 'checklist-update'
  ) {
    return value;
  }
  throw new Error('proposedChanges.type is required');
}

function assertTemplateBackflowProposedChanges(value: unknown): TemplateBackflowDraft['proposedChanges'] {
  if (!Array.isArray(value)) {
    throw new Error('proposedChanges is required');
  }

  return value.map((item) => {
    const change = assertObject(item);
    return {
      type: assertTemplateBackflowChangeType(change.type),
      description: assertString(change.description, 'proposedChanges.description'),
    };
  });
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} is required`);
  }
  return value;
}
