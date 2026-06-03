import type { HotRunSummary, HotSource, SigninRunSummary, TaskBatch } from '@shared/types';
import {
  createSigninProjectionId,
  getBatchStatusLabel,
  getSigninStatusLabel,
  isSigninTerminalStatus,
} from './status';

export type RunSourceType = 'batch' | 'signin' | 'hot';

export type RunAction =
  | 'retry-batch'
  | 'intervention'
  | 'intervention-retry'
  | 'rerun-signin'
  | 'view-result'
  | 'generate-hot-report'
  | 'view-hot-report';

export interface UnifiedRunRecord {
  runId: string;
  sourceType: RunSourceType;
  taskId: string;
  batchId?: string | null;
  rawStatus: string;
  statusLabel: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  debug: unknown;
  resultCount?: number;
  reportStatus?: HotRunSummary['reportStatus'];
  actions: RunAction[];
  raw: TaskBatch | SigninRunSummary | HotRunSummary;
}

export interface RunMonitorViewModel {
  runs: UnifiedRunRecord[];
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export function buildRunMonitorViewModel(input: {
  batches: TaskBatch[];
  signinRuns: SigninRunSummary[];
  hotRuns?: HotRunSummary[];
  hotSources?: HotSource[];
}): RunMonitorViewModel {
  const signinDuplicateCounts = countSigninDuplicates(input.signinRuns);
  const batchRuns = input.batches.map(toBatchRunRecord);
  const signinRuns = input.signinRuns.map((run, index) =>
    toSigninRunRecord(run, index, signinDuplicateCounts.get(`${run.taskId}:${run.runAt}`) ?? 1),
  );
  const hotRuns = (input.hotRuns ?? []).map((run) => toHotRunRecord(run, input.hotSources ?? []));
  const runs = [...batchRuns, ...signinRuns, ...hotRuns].sort(compareRunsDesc);

  return {
    runs,
    emptyState:
      runs.length === 0
        ? {
            title: '还没有运行记录',
            description: '普通批次、京东签到运行历史和热点运行会在这里展示。',
          }
        : null,
  };
}

function toBatchRunRecord(batch: TaskBatch): UnifiedRunRecord {
  return {
    runId: `batch:${batch.id}`,
    sourceType: 'batch',
    taskId: batch.taskId,
    batchId: batch.id,
    rawStatus: batch.status,
    statusLabel: getBatchStatusLabel(batch.status),
    startedAt: batch.startedAt ?? batch.createdAt,
    finishedAt: batch.finishedAt ?? null,
    error: batch.error ?? batch.breakpoint?.error ?? null,
    debug: {
      stepResults: batch.stepResults,
      breakpoint: batch.breakpoint ?? null,
      hasSteps: batch.stepResults.length > 0,
    },
    actions: getBatchActions(batch),
    raw: batch,
  };
}

function toSigninRunRecord(
  run: SigninRunSummary,
  index: number,
  duplicateCount: number,
): UnifiedRunRecord {
  return {
    runId: createSigninProjectionId(run.taskId, run.runAt, index, duplicateCount),
    sourceType: 'signin',
    taskId: run.taskId,
    batchId: null,
    rawStatus: run.status,
    statusLabel: getSigninStatusLabel(run.status),
    startedAt: run.runAt,
    finishedAt: isSigninTerminalStatus(run.status) ? run.runAt : null,
    error: run.detail ?? run.failureReason ?? null,
    debug: run.debug ?? null,
    actions: getSigninActions(run),
    raw: run,
  };
}

function toHotRunRecord(run: HotRunSummary, hotSources: HotSource[]): UnifiedRunRecord {
  const source = hotSources.find((item) => item.id === run.sourceId);
  return {
    runId: `hot:${run.sourceId}:${run.batchId}`,
    sourceType: 'hot',
    taskId: source?.taskId ?? '',
    batchId: run.batchId,
    rawStatus: run.status,
    statusLabel: getBatchStatusLabel(run.status as TaskBatch['status']),
    startedAt: run.startedAt ?? run.finishedAt ?? '',
    finishedAt: run.finishedAt ?? null,
    error: null,
    debug: {
      sourceId: run.sourceId,
      sourceName: run.sourceName,
      resultCount: run.resultCount,
      reportStatus: run.reportStatus,
    },
    resultCount: run.resultCount,
    reportStatus: run.reportStatus,
    actions:
      run.reportStatus === 'generated'
        ? ['view-result', 'view-hot-report']
        : ['view-result', 'generate-hot-report'],
    raw: run,
  };
}

function getBatchActions(batch: TaskBatch): RunAction[] {
  if (batch.status === 'failed') return ['retry-batch', 'view-result'];
  if (batch.status === 'intervention') return ['intervention', 'view-result'];
  if (batch.status === 'success') return ['view-result'];
  return [];
}

function getSigninActions(run: SigninRunSummary): RunAction[] {
  if (run.status === 'needs_intervention') return ['intervention-retry', 'view-result'];
  if (run.status === 'failed') return ['rerun-signin', 'view-result'];
  if (run.status === 'success') return ['view-result'];
  return [];
}

function countSigninDuplicates(runs: SigninRunSummary[]): Map<string, number> {
  const counts = new Map<string, number>();
  runs.forEach((run) => {
    const key = `${run.taskId}:${run.runAt}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function compareRunsDesc(a: UnifiedRunRecord, b: UnifiedRunRecord): number {
  const diff = new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  if (diff !== 0) return diff;
  return b.runId.localeCompare(a.runId);
}
