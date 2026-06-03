import type { ExtractionResult, SigninRunSummary, TaskBatch } from '@shared/types';
import type { TaskTemplateDefinition } from './templates';
import { buildResultLibraryViewModel, type UnifiedResultItem } from './resultLibraryViewModel';
import {
  getBatchStatusLabel,
  getSigninStatusLabel,
  getTaskStatusLabel,
  isSigninRunningStatus,
} from './status';

export interface WorkbenchTaskSummary {
  id: string;
  name: string;
  status: string;
  description?: string;
  entryUrl?: string;
  updatedAt: string;
  schedule?: unknown;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  kind?: string;
  templateId?: string | null;
  latestBatch?: {
    id: string;
    taskId: string;
    status: string;
    createdAt: string;
    stepResults: unknown[];
  } | null;
}

export type WorkbenchItemSourceType = 'task' | 'batch' | 'signin';

export interface WorkbenchStatusItem {
  id: string;
  sourceType: WorkbenchItemSourceType;
  taskId: string;
  taskName: string;
  rawStatus: string;
  statusLabel: string;
  occurredAt: string;
  summary: string;
  navigateTo: string;
}

export interface TaskWorkbenchViewModel {
  runningItems: WorkbenchStatusItem[];
  failedItems: WorkbenchStatusItem[];
  recentCompletedItems: WorkbenchStatusItem[];
  recentResults: UnifiedResultItem[];
  recommendedTemplates: TaskTemplateDefinition[];
  emptyState: {
    title: string;
    description: string;
    primaryAction: 'from-template';
  } | null;
  errors: string[];
  totals: {
    tasks: number;
    running: number;
    failed: number;
    completed: number;
    results: number;
  };
}

export function buildTaskWorkbenchViewModel(input: {
  tasks: WorkbenchTaskSummary[];
  signinStatuses: Record<string, SigninRunSummary | null | undefined>;
  standardResults: ExtractionResult[];
  signinHistories: Record<string, SigninRunSummary[] | undefined>;
  templates: TaskTemplateDefinition[];
  errors?: string[];
}): TaskWorkbenchViewModel {
  const latestItems = input.tasks.map((task) =>
    resolveLatestWorkbenchItem(task, input.signinStatuses[task.id] ?? null),
  );
  const resultModel = buildResultLibraryViewModel({
    standardResults: input.standardResults,
    signinRuns: Object.values(input.signinHistories).flatMap((runs) => runs ?? []),
  });

  const runningItems = latestItems
    .filter((item) => isRunningItem(item))
    .sort(compareItemsDesc);
  const failedItems = latestItems
    .filter((item) => isFailedItem(item))
    .sort(compareItemsDesc);
  const recentCompletedItems = latestItems
    .filter((item) => isCompletedItem(item))
    .sort(compareItemsDesc)
    .slice(0, 6);

  return {
    runningItems,
    failedItems,
    recentCompletedItems,
    recentResults: resultModel.items.slice(0, 8),
    recommendedTemplates: [...input.templates].sort((a, b) =>
      a.status === b.status ? 0 : a.status === 'ready' ? -1 : 1,
    ),
    emptyState:
      input.tasks.length === 0
        ? {
            title: '还没有任务',
            description: '从京东签到模板开始创建第一个本地任务。',
            primaryAction: 'from-template',
          }
        : null,
    errors: input.errors ?? [],
    totals: {
      tasks: input.tasks.length,
      running: runningItems.length,
      failed: failedItems.length,
      completed: recentCompletedItems.length,
      results: resultModel.items.length,
    },
  };
}

function resolveLatestWorkbenchItem(
  task: WorkbenchTaskSummary,
  signinStatus: SigninRunSummary | null,
): WorkbenchStatusItem {
  const batchItem = task.latestBatch ? toBatchWorkbenchItem(task, task.latestBatch) : null;
  const signinItem = signinStatus ? toSigninWorkbenchItem(task, signinStatus) : null;

  if (batchItem && signinItem) {
    return new Date(signinItem.occurredAt).getTime() >= new Date(batchItem.occurredAt).getTime()
      ? signinItem
      : batchItem;
  }
  return signinItem ?? batchItem ?? toTaskWorkbenchItem(task);
}

function toBatchWorkbenchItem(
  task: WorkbenchTaskSummary,
  batch: NonNullable<WorkbenchTaskSummary['latestBatch']>,
): WorkbenchStatusItem {
  return {
    id: `batch:${batch.id}`,
    sourceType: 'batch',
    taskId: task.id,
    taskName: task.name,
    rawStatus: batch.status,
    statusLabel: getBatchStatusLabel(batch.status as TaskBatch['status']),
    occurredAt: batch.createdAt,
    summary: batch.stepResults.length > 0 ? `${batch.stepResults.length} 个步骤结果` : '无步骤结果',
    navigateTo: `/runs?taskId=${encodeURIComponent(task.id)}&runId=batch:${encodeURIComponent(batch.id)}`,
  };
}

function toSigninWorkbenchItem(
  task: WorkbenchTaskSummary,
  signin: SigninRunSummary,
): WorkbenchStatusItem {
  return {
    id: `signin:${signin.taskId}:${signin.runAt}`,
    sourceType: 'signin',
    taskId: task.id,
    taskName: task.name,
    rawStatus: signin.status,
    statusLabel: getSigninStatusLabel(signin.status),
    occurredAt: signin.runAt,
    summary: signin.detail ?? signin.failureReason ?? getSigninStatusLabel(signin.status),
    navigateTo: `/runs?taskId=${encodeURIComponent(task.id)}`,
  };
}

function toTaskWorkbenchItem(task: WorkbenchTaskSummary): WorkbenchStatusItem {
  return {
    id: `task:${task.id}`,
    sourceType: 'task',
    taskId: task.id,
    taskName: task.name,
    rawStatus: task.status,
    statusLabel: task.status === 'idle' ? '未运行' : getTaskStatusLabel(task.status),
    occurredAt: task.lastRunAt ?? task.updatedAt,
    summary: task.entryUrl ?? task.description ?? '未运行',
    navigateTo: `/tasks/editor?taskId=${encodeURIComponent(task.id)}`,
  };
}

function isRunningItem(item: WorkbenchStatusItem): boolean {
  if (item.sourceType === 'signin') {
    return isSigninRunningStatus(item.rawStatus as SigninRunSummary['status']);
  }
  return item.rawStatus === 'running' || item.rawStatus === 'pending';
}

function isFailedItem(item: WorkbenchStatusItem): boolean {
  return item.rawStatus === 'failed' || item.rawStatus === 'intervention' || item.rawStatus === 'needs_intervention';
}

function isCompletedItem(item: WorkbenchStatusItem): boolean {
  return item.rawStatus === 'success' || item.rawStatus === 'completed';
}

function compareItemsDesc(a: WorkbenchStatusItem, b: WorkbenchStatusItem): number {
  return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
}
