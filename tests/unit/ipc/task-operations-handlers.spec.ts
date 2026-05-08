import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerTaskOperationsHandlers } from '@main/ipc/task-operations-handlers';

describe('registerTaskOperationsHandlers', () => {
  it('registers workspace and revision channels and forwards payloads', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const workspaceService = {
      listWorkspaces: vi.fn(() => [{ id: 'workspace-1' }]),
      createWorkspace: vi.fn((payload) => ({ id: 'workspace-2', ...payload })),
      updateWorkspace: vi.fn((workspaceId, payload) => ({ id: workspaceId, ...payload })),
      listMembers: vi.fn(() => [{ id: 'member-1' }]),
      listDutyShifts: vi.fn((workspaceId) => [{ id: 'shift-1', workspaceId }]),
      saveDutyShift: vi.fn((payload) => ({ id: 'shift-1', ...payload })),
      resolveDutyPolicy: vi.fn((workspaceId) => ({
        workspaceId,
        currentOperator: { id: 'member-2', name: 'Operator B' },
        nextOperator: {
          id: 'member-3',
          name: 'Operator C',
          startsAt: '2026-04-22T16:00:00.000Z',
          endsAt: '2026-04-23T00:00:00.000Z',
        },
        escalationOwner: { id: 'member-1', name: 'Owner A' },
        alertAutoEscalateMinutes: 10,
      })),
      updateMemberRole: vi.fn((workspaceId, memberId, role) => ({
        id: memberId,
        workspaceId,
        role,
      })),
    };
    const taskRevisionService = {
      listRevisions: vi.fn(() => [{ id: 'revision-1' }]),
      publishRevision: vi.fn((taskId, payload) => ({ id: 'revision-2', taskId, ...payload })),
      reviewRevision: vi.fn((revisionId, payload) => ({ id: revisionId, ...payload })),
      compareRevisions: vi.fn((baseRevisionId, targetRevisionId) => ({
        baseRevisionId,
        targetRevisionId,
        changes: [],
      })),
    };
    const reviewService = {
      listReviews: vi.fn(() => [{ id: 'review-1' }]),
      createReview: vi.fn((payload) => ({ id: 'review-new', ...payload })),
      suggestTemplateBackflow: vi.fn((reviewId, templateId) => ({
        reviewId,
        templateId,
        recommended: true,
      })),
      createTemplateBackflowDraft: vi.fn((reviewId, templateId) => ({
        reviewId,
        templateId,
        status: 'draft',
      })),
    };
    const alertService = {
      claimAlert: vi.fn((alertId, assignee) => ({ id: alertId, assignee })),
      assignAlert: vi.fn((alertId, assignee, operator, note) => ({
        id: alertId,
        assignee,
        operator,
        note,
      })),
      addAlertNote: vi.fn((alertId, operator, note) => ({ id: alertId, operator, note })),
      listAlertActions: vi.fn((alertId) => [{ id: 'action-1', alertId, action: 'note' }]),
      escalateAlert: vi.fn((alertId, operator, note) => ({ id: alertId, operator, note, status: 'escalated' })),
      closeAlert: vi.fn((alertId, resolution, operator) => ({ id: alertId, resolution, operator, status: 'closed' })),
    };
    const resultService = {
      analyzeCrossBatchQuality: vi.fn((taskId, rule) => ({
        taskId,
        rule,
        batchSummaries: [],
      })),
    };
    const operationsMetricsService = {
      buildAcceptanceMetrics: vi.fn((taskId?: string) => [
        {
          key: 'taskSuccessRate',
          label: '任务执行成功率',
          value: taskId === 'task-1' ? 1 : 0.92,
          target: 0.9,
          unit: 'ratio',
          passed: true,
        },
      ]),
    };
    const templateService = {
      linkReview: vi.fn((reviewId, templateId) => ({ reviewId, templateId })),
      applyTemplateBackflowDraft: vi.fn((draft, appliedBy) => ({
        reviewId: draft.reviewId,
        templateId: draft.templateId,
        appliedBy,
      })),
    };

    registerTaskOperationsHandlers({
      ipcController,
      workspaceService,
      taskRevisionService,
      reviewService,
      alertService,
      templateService,
      resultService,
      operationsMetricsService,
    });

    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.WORKSPACE_LIST,
      expect.any(Function),
    );
    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.TASK_REVISION_PUBLISH,
      expect.any(Function),
    );

    expect(await handlers.get(IPC_CHANNELS.WORKSPACE_LIST)?.({})).toEqual([
      { id: 'workspace-1' },
    ]);
    expect(
      await handlers.get(IPC_CHANNELS.WORKSPACE_UPDATE)?.({
        workspaceId: 'workspace-1',
        updates: { name: '新工作区' },
      }),
    ).toEqual({ id: 'workspace-1', name: '新工作区' });
    expect(
      await handlers.get(IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_LIST)?.({
        workspaceId: 'workspace-1',
      }),
    ).toEqual([{ id: 'shift-1', workspaceId: 'workspace-1' }]);
    expect(
      await handlers.get(IPC_CHANNELS.WORKSPACE_DUTY_SHIFT_SAVE)?.({
        workspaceId: 'workspace-1',
        memberId: 'member-2',
        startsAt: '2026-04-22T08:00:00.000Z',
        endsAt: '2026-04-22T16:00:00.000Z',
      }),
    ).toEqual({
      id: 'shift-1',
      workspaceId: 'workspace-1',
      memberId: 'member-2',
      startsAt: '2026-04-22T08:00:00.000Z',
      endsAt: '2026-04-22T16:00:00.000Z',
    });
    expect(
      await handlers.get(IPC_CHANNELS.WORKSPACE_DUTY_GET)?.({
        workspaceId: 'workspace-1',
      }),
    ).toEqual({
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
    expect(
      await handlers.get(IPC_CHANNELS.TASK_REVISION_PUBLISH)?.({
        taskId: 'task-1',
        version: 'v1',
      }),
    ).toEqual({ id: 'revision-2', taskId: 'task-1', version: 'v1' });
    expect(
      await handlers.get(IPC_CHANNELS.TASK_REVISION_COMPARE)?.({
        baseRevisionId: 'revision-1',
        targetRevisionId: 'revision-2',
      }),
    ).toEqual({
      baseRevisionId: 'revision-1',
      targetRevisionId: 'revision-2',
      changes: [],
    });
    expect(
      await handlers.get(IPC_CHANNELS.ALERT_ESCALATE)?.({
        alertId: 'alert-1',
        operator: 'owner-a',
        note: '高优先级处理',
      }),
    ).toEqual({ id: 'alert-1', operator: 'owner-a', note: '高优先级处理', status: 'escalated' });
    expect(
      await handlers.get(IPC_CHANNELS.TEMPLATE_LINK_REVIEW)?.({
        reviewId: 'review-1',
        templateId: 'template-1',
      }),
    ).toEqual({ reviewId: 'review-1', templateId: 'template-1' });
    expect(
      await handlers.get(IPC_CHANNELS.RESULT_QUALITY_ANALYZE)?.({
        taskId: 'task-1',
        rule: { requiredFields: ['price'] },
      }),
    ).toEqual({
      taskId: 'task-1',
      rule: { requiredFields: ['price'] },
      batchSummaries: [],
    });
    expect(
      await handlers.get(IPC_CHANNELS.OPS_ACCEPTANCE_METRICS)?.({
        taskId: 'task-1',
      }),
    ).toEqual([
      {
        key: 'taskSuccessRate',
        label: '任务执行成功率',
        value: 1,
        target: 0.9,
        unit: 'ratio',
        passed: true,
      },
    ]);
    expect(
      await handlers.get(IPC_CHANNELS.ALERT_ASSIGN)?.({
        alertId: 'alert-1',
        assignee: 'operator-b',
        operator: 'owner-a',
        note: '转交给值班员',
      }),
    ).toEqual({
      id: 'alert-1',
      assignee: 'operator-b',
      operator: 'owner-a',
      note: '转交给值班员',
    });
    expect(
      await handlers.get(IPC_CHANNELS.ALERT_ACTION_LIST)?.({
        alertId: 'alert-1',
      }),
    ).toEqual([{ id: 'action-1', alertId: 'alert-1', action: 'note' }]);
    expect(
      await handlers.get(IPC_CHANNELS.TEMPLATE_BACKFLOW_APPLY)?.({
        draft: {
          reviewId: 'review-1',
          templateId: 'template-1',
          title: '回流复盘结论到模板',
          status: 'draft',
          riskLevel: 'medium',
          proposedChanges: [],
          executionSteps: [],
          acceptanceCriteria: [],
        },
        appliedBy: 'operator-a',
      }),
    ).toEqual({
      reviewId: 'review-1',
      templateId: 'template-1',
      appliedBy: 'operator-a',
    });
    expect(
      await handlers.get(IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_SUGGEST)?.({
        reviewId: 'review-1',
        templateId: 'template-1',
      }),
    ).toEqual({
      reviewId: 'review-1',
      templateId: 'template-1',
      recommended: true,
    });
    expect(
      await handlers.get(IPC_CHANNELS.REVIEW_TEMPLATE_BACKFLOW_DRAFT)?.({
        reviewId: 'review-1',
        templateId: 'template-1',
      }),
    ).toEqual({
      reviewId: 'review-1',
      templateId: 'template-1',
      status: 'draft',
    });
  });
});
