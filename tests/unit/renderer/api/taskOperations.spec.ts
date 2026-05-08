import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { createTaskOperationsApi } from '@renderer/shared/api/taskOperations';

describe('createTaskOperationsApi', () => {
  it.each([
    {
      name: 'listWorkspaces',
      run: (api: ReturnType<typeof createTaskOperationsApi>) => api.listWorkspaces(),
      channel: IPC_CHANNELS.WORKSPACE_LIST,
    },
    {
      name: 'createWorkspace',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.createWorkspace({ name: '电商巡检组' }),
      channel: IPC_CHANNELS.WORKSPACE_CREATE,
      payload: { name: '电商巡检组' },
    },
    {
      name: 'getWorkspaceDuty',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.getWorkspaceDuty('workspace-1'),
      channel: IPC_CHANNELS.WORKSPACE_DUTY_GET,
      payload: { workspaceId: 'workspace-1' },
    },
    {
      name: 'listWorkspaceDutyShifts',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.listWorkspaceDutyShifts('workspace-1'),
      channel: IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_LIST,
      payload: { workspaceId: 'workspace-1' },
    },
    {
      name: 'saveWorkspaceDutyShift',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.saveWorkspaceDutyShift({
          workspaceId: 'workspace-1',
          memberId: 'member-2',
          startsAt: '2026-04-22T08:00:00.000Z',
          endsAt: '2026-04-22T16:00:00.000Z',
        }),
      channel: IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_SAVE,
      payload: {
        workspaceId: 'workspace-1',
        memberId: 'member-2',
        startsAt: '2026-04-22T08:00:00.000Z',
        endsAt: '2026-04-22T16:00:00.000Z',
      },
    },
    {
      name: 'publishTaskRevision',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.publishTaskRevision({ taskId: 'task-1', version: 'v1' }),
      channel: IPC_CHANNELS.TASK_REVISION_PUBLISH,
      payload: { taskId: 'task-1', version: 'v1' },
    },
    {
      name: 'reviewTaskRevision',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.reviewTaskRevision({ revisionId: 'revision-1', action: 'approve', reviewer: 'owner' }),
      channel: IPC_CHANNELS.TASK_REVISION_REVIEW,
      payload: { revisionId: 'revision-1', action: 'approve', reviewer: 'owner' },
    },
    {
      name: 'compareTaskRevisions',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.compareTaskRevisions({
          baseRevisionId: 'revision-1',
          targetRevisionId: 'revision-2',
        }),
      channel: IPC_CHANNELS.TASK_REVISION_COMPARE,
      payload: {
        baseRevisionId: 'revision-1',
        targetRevisionId: 'revision-2',
      },
    },
    {
      name: 'escalateAlert',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.escalateAlert('alert-1', 'owner-a', '高优先级处理'),
      channel: IPC_CHANNELS.ALERT_ESCALATE,
      payload: { alertId: 'alert-1', operator: 'owner-a', note: '高优先级处理' },
    },
    {
      name: 'closeAlert',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.closeAlert('alert-1', '已修复', 'owner-a'),
      channel: IPC_CHANNELS.ALERT_CLOSE,
      payload: { alertId: 'alert-1', resolution: '已修复', operator: 'owner-a' },
    },
    {
      name: 'analyzeResultQuality',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.analyzeResultQuality({
          taskId: 'task-1',
          rule: { requiredFields: ['price'], minBatchResultCount: 2 },
        }),
      channel: IPC_CHANNELS.RESULT_QUALITY_ANALYZE,
      payload: {
        taskId: 'task-1',
        rule: { requiredFields: ['price'], minBatchResultCount: 2 },
      },
    },
    {
      name: 'getAcceptanceMetrics',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.getAcceptanceMetrics({ taskId: 'task-1' }),
      channel: IPC_CHANNELS.OPS_ACCEPTANCE_METRICS,
      payload: { taskId: 'task-1' },
    },
    {
      name: 'linkReviewTemplate',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.linkReviewTemplate({ reviewId: 'review-1', templateId: 'template-1' }),
      channel: IPC_CHANNELS.TEMPLATE_LINK_REVIEW,
      payload: { reviewId: 'review-1', templateId: 'template-1' },
    },
    {
      name: 'assignAlert',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.assignAlert('alert-1', 'operator-b', 'owner-a', '转交给值班员'),
      channel: IPC_CHANNELS.ALERT_ASSIGN,
      payload: {
        alertId: 'alert-1',
        assignee: 'operator-b',
        operator: 'owner-a',
        note: '转交给值班员',
      },
    },
    {
      name: 'addAlertNote',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.addAlertNote('alert-1', 'operator-b', '已检查日志'),
      channel: IPC_CHANNELS.ALERT_NOTE,
      payload: { alertId: 'alert-1', operator: 'operator-b', note: '已检查日志' },
    },
    {
      name: 'listAlertActions',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.listAlertActions('alert-1'),
      channel: IPC_CHANNELS.ALERT_ACTION_LIST,
      payload: { alertId: 'alert-1' },
    },
    {
      name: 'suggestTemplateBackflow',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.suggestTemplateBackflow({ reviewId: 'review-1', templateId: 'template-1' }),
      channel: IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_SUGGEST,
      payload: { reviewId: 'review-1', templateId: 'template-1' },
    },
    {
      name: 'createTemplateBackflowDraft',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.createTemplateBackflowDraft({ reviewId: 'review-1', templateId: 'template-1' }),
      channel: IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_DRAFT,
      payload: { reviewId: 'review-1', templateId: 'template-1' },
    },
    {
      name: 'applyTemplateBackflowDraft',
      run: (api: ReturnType<typeof createTaskOperationsApi>) =>
        api.applyTemplateBackflowDraft({
          draft: { reviewId: 'review-1', templateId: 'template-1' },
          appliedBy: 'operator-a',
        }),
      channel: IPC_CHANNELS.TEMPLATE_BACKFLOW_APPLY,
      payload: {
        draft: { reviewId: 'review-1', templateId: 'template-1' },
        appliedBy: 'operator-a',
      },
    },
  ])('invokes expected channel for $name', async ({ run, channel, payload }) => {
    const invoke = vi.fn().mockResolvedValue(null);
    const api = createTaskOperationsApi({ invoke });

    await expect(run(api)).resolves.toBeNull();
    if (payload === undefined) {
      expect(invoke).toHaveBeenCalledWith(channel);
      return;
    }
    expect(invoke).toHaveBeenCalledWith(channel, payload);
  });
});
