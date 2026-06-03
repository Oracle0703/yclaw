import type { SigninRunStatus, TaskBatchStatus } from '@shared/types';

export type TaskToolbenchResultStatus = 'normal' | 'suspicious' | 'failed' | 'running' | 'pending';

export function getBatchStatusLabel(status: TaskBatchStatus): string {
  const labels: Record<TaskBatchStatus, string> = {
    pending: '等待中',
    running: '运行中',
    success: '成功',
    failed: '失败',
    cancelled: '已取消',
    paused: '已暂停',
    intervention: '需人工介入',
  };
  return labels[status];
}

export function getTaskStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: '空闲',
    running: '运行中',
    paused: '已暂停',
    completed: '成功',
    failed: '失败',
  };
  return labels[status] ?? status;
}

export function getSigninStatusLabel(status: SigninRunStatus): string {
  const labels: Record<SigninRunStatus, string> = {
    pending: '等待中',
    running_browser: '浏览器运行中',
    running_api_fallback: 'API 兜底运行中',
    retry_scheduled: '已安排重试',
    needs_intervention: '需人工介入',
    success: '成功',
    failed: '失败',
  };
  return labels[status];
}

export function getSigninDisplayStatus(status: SigninRunStatus): TaskToolbenchResultStatus {
  if (status === 'success') return 'normal';
  if (status === 'failed' || status === 'needs_intervention') return 'failed';
  if (status === 'pending' || status === 'retry_scheduled') return 'pending';
  return 'running';
}

export function isSigninRunningStatus(status: SigninRunStatus): boolean {
  return (
    status === 'pending' ||
    status === 'running_browser' ||
    status === 'running_api_fallback' ||
    status === 'retry_scheduled'
  );
}

export function isSigninTerminalStatus(status: SigninRunStatus): boolean {
  return status === 'success' || status === 'failed' || status === 'needs_intervention';
}

export function getSigninSummaryText(input: {
  reward?: { detailText?: string; earnedBeans?: number; balanceStr?: string } | null;
  detail?: string;
  failureReason?: string;
  statusLabel: string;
}): string {
  if (input.reward?.detailText) return input.reward.detailText;
  if (typeof input.reward?.earnedBeans === 'number') return `获得 ${input.reward.earnedBeans} 京豆`;
  if (input.reward?.balanceStr) return `京豆余额 ${input.reward.balanceStr}`;
  if (input.detail) return input.detail;
  if (input.failureReason) return input.failureReason;
  return input.statusLabel;
}

export function createSigninProjectionId(
  taskId: string,
  runAt: string,
  index: number,
  duplicateCount: number,
): string {
  const baseId = `signin:${taskId}:${runAt}`;
  return duplicateCount > 1 ? `${baseId}:${index}` : baseId;
}
