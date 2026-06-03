import type { ExtractionResult, HotReportSummary, HotSource, SigninRunSummary } from '@shared/types';
import {
  createSigninProjectionId,
  getSigninDisplayStatus,
  getSigninStatusLabel,
  getSigninSummaryText,
  type TaskToolbenchResultStatus,
} from './status';

export type ResultSourceType = 'standard' | 'signin' | 'hot' | 'comment';

export type ResultDetailRef =
  | { sourceType: 'standard'; resultId: string }
  | { sourceType: 'signin'; taskId: string; runId: string }
  | { sourceType: 'hot'; reportId: string };

export interface UnifiedResultItem {
  id: string;
  sourceType: ResultSourceType;
  taskId: string;
  batchId: string | null;
  title: string;
  status: TaskToolbenchResultStatus;
  statusLabel: string;
  createdAt: string;
  summary: string;
  detailRef: ResultDetailRef;
  exportableFormats: Array<'json' | 'jsonl' | 'csv'>;
  raw: ExtractionResult | SigninRunSummary | HotReportSummary;
}

export interface ResultLibraryViewModel {
  items: UnifiedResultItem[];
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export function buildResultLibraryViewModel(input: {
  standardResults: ExtractionResult[];
  signinRuns: SigninRunSummary[];
  hotReports?: HotReportSummary[];
  hotSources?: HotSource[];
}): ResultLibraryViewModel {
  const signinDuplicateCounts = countSigninDuplicates(input.signinRuns);
  const standardItems = input.standardResults.map(toStandardResultItem);
  const signinItems = input.signinRuns.map((run, index) =>
    toSigninResultItem(run, index, signinDuplicateCounts.get(`${run.taskId}:${run.runAt}`) ?? 1),
  );
  const hotItems = (input.hotReports ?? []).map((report) =>
    toHotReportItem(report, input.hotSources ?? []),
  );
  const items = [...standardItems, ...signinItems, ...hotItems].sort(compareByCreatedAtDesc);

  return {
    items,
    emptyState:
      items.length === 0
        ? {
            title: '还没有任务结果',
            description: '任务运行后，标准结果、签到专项结果和热点报告会汇总到这里。',
          }
        : null,
  };
}

function toStandardResultItem(result: ExtractionResult): UnifiedResultItem {
  const title = typeof result.data.title === 'string' ? result.data.title : '标准采集结果';
  return {
    id: result.id,
    sourceType: 'standard',
    taskId: result.taskId,
    batchId: result.batchId,
    title,
    status: result.status,
    statusLabel: getStandardResultStatusLabel(result.status),
    createdAt: result.createdAt,
    summary: summarizeData(result.data),
    detailRef: { sourceType: 'standard', resultId: result.id },
    exportableFormats: ['json', 'jsonl', 'csv'],
    raw: result,
  };
}

function toSigninResultItem(
  run: SigninRunSummary,
  index: number,
  duplicateCount: number,
): UnifiedResultItem {
  const id = createSigninProjectionId(run.taskId, run.runAt, index, duplicateCount);
  const statusLabel = getSigninStatusLabel(run.status);
  return {
    id,
    sourceType: 'signin',
    taskId: run.taskId,
    batchId: null,
    title: '京东签到',
    status: getSigninDisplayStatus(run.status),
    statusLabel,
    createdAt: run.runAt,
    summary: getSigninSummaryText({
      reward: run.reward,
      detail: run.detail,
      failureReason: run.failureReason,
      statusLabel,
    }),
    detailRef: { sourceType: 'signin', taskId: run.taskId, runId: id },
    exportableFormats: ['json'],
    raw: run,
  };
}

function toHotReportItem(report: HotReportSummary, hotSources: HotSource[]): UnifiedResultItem {
  const source = hotSources.find((item) => item.id === report.sourceId);
  return {
    id: `hot-report:${report.id}`,
    sourceType: 'hot',
    taskId: source?.taskId ?? '',
    batchId: report.batchId,
    title: report.title,
    status: 'normal',
    statusLabel: '已生成',
    createdAt: report.createdAt,
    summary: `${report.format.toUpperCase()} · ${report.filePath}`,
    detailRef: { sourceType: 'hot', reportId: report.id },
    exportableFormats: [],
    raw: report,
  };
}

function getStandardResultStatusLabel(status: ExtractionResult['status']): string {
  const labels: Record<ExtractionResult['status'], string> = {
    normal: '正常',
    suspicious: '可疑',
    failed: '失败',
  };
  return labels[status];
}

function summarizeData(data: Record<string, unknown>): string {
  const keys = Object.keys(data);
  if (keys.length === 0) return '空结果';
  return keys
    .slice(0, 3)
    .map((key) => `${key}: ${String(data[key])}`)
    .join(' / ');
}

function countSigninDuplicates(runs: SigninRunSummary[]): Map<string, number> {
  const counts = new Map<string, number>();
  runs.forEach((run) => {
    const key = `${run.taskId}:${run.runAt}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function compareByCreatedAtDesc(a: UnifiedResultItem, b: UnifiedResultItem): number {
  const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (diff !== 0) return diff;
  return b.id.localeCompare(a.id);
}
