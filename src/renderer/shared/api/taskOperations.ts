import { IPC_CHANNELS } from '@shared/constants';

type Invoke = (channel: string, payload?: unknown) => Promise<unknown>;

export function createTaskOperationsApi(options: { invoke: Invoke }) {
  return {
    listWorkspaces: () => options.invoke(IPC_CHANNELS.WORKSPACE_LIST),
    createWorkspace: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.WORKSPACE_CREATE, payload),
    updateWorkspace: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.WORKSPACE_UPDATE, payload),
    getWorkspaceDuty: (workspaceId: string) =>
      options.invoke(IPC_CHANNELS.WORKSPACE_DUTY_GET, { workspaceId }),
    listWorkspaceDutyShifts: (workspaceId: string) =>
      options.invoke(IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_LIST, { workspaceId }),
    saveWorkspaceDutyShift: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_SAVE, payload),
    listMembers: (workspaceId: string) =>
      options.invoke(IPC_CHANNELS.WORKSPACE_MEMBER_LIST, { workspaceId }),
    updateMemberRole: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.WORKSPACE_MEMBER_UPDATE_ROLE, payload),
    listTaskRevisions: (taskId: string) =>
      options.invoke(IPC_CHANNELS.TASK_REVISION_LIST, { taskId }),
    publishTaskRevision: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.TASK_REVISION_PUBLISH, payload),
    reviewTaskRevision: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.TASK_REVISION_REVIEW, payload),
    compareTaskRevisions: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.TASK_REVISION_COMPARE, payload),
    listAlerts: (taskId?: string) => options.invoke(IPC_CHANNELS.ALERT_LIST, { taskId }),
    claimAlert: (alertId: string, assignee?: string) =>
      options.invoke(IPC_CHANNELS.ALERT_CLAIM, { alertId, assignee }),
    assignAlert: (alertId: string, assignee?: string, operator?: string, note?: string) =>
      options.invoke(IPC_CHANNELS.ALERT_ASSIGN, {
        alertId,
        assignee: assignee ?? 'current-operator',
        operator,
        note,
      }),
    addAlertNote: (alertId: string, operator?: string, note?: string) =>
      options.invoke(IPC_CHANNELS.ALERT_NOTE, {
        alertId,
        operator,
        note: note ?? '已补充处理备注',
      }),
    listAlertActions: (alertId: string) =>
      options.invoke(IPC_CHANNELS.ALERT_ACTION_LIST, { alertId }),
    escalateAlert: (alertId: string, operator?: string, note?: string) =>
      options.invoke(IPC_CHANNELS.ALERT_ESCALATE, { alertId, operator, note }),
    closeAlert: (alertId: string, resolution?: string, operator?: string) =>
      options.invoke(IPC_CHANNELS.ALERT_CLOSE, { alertId, resolution, operator }),
    analyzeResultQuality: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.RESULT_QUALITY_ANALYZE, payload),
    getAcceptanceMetrics: (payload?: unknown) =>
      options.invoke(IPC_CHANNELS.OPS_ACCEPTANCE_METRICS, payload ?? {}),
    listReviews: (taskId?: string, batchId?: string) =>
      options.invoke(IPC_CHANNELS.REVIEW_LIST, { taskId, batchId }),
    createReview: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REVIEW_CREATE, payload),
    suggestTemplateBackflow: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_SUGGEST, payload),
    createTemplateBackflowDraft: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_DRAFT, payload),
    applyTemplateBackflowDraft: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.TEMPLATE_BACKFLOW_APPLY, payload),
    linkReviewTemplate: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.TEMPLATE_LINK_REVIEW, payload),
  };
}
