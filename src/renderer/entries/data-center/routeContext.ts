import type { DataCenterResultQuery } from '@shared/types';

export interface DataCenterRouteContext {
  taskId?: string;
  batchId?: string;
  source?: string;
}

export function parseDataCenterRouteContext(state: unknown): DataCenterRouteContext | null {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const value = state as Record<string, unknown>;
  const context: DataCenterRouteContext = {};

  if (typeof value.taskId === 'string' && value.taskId.length > 0) {
    context.taskId = value.taskId;
  }
  if (typeof value.batchId === 'string' && value.batchId.length > 0) {
    context.batchId = value.batchId;
  }
  if (typeof value.source === 'string' && value.source.length > 0) {
    context.source = value.source;
  }

  return context.taskId || context.batchId || context.source ? context : null;
}

export function buildDataCenterResultQuery(
  context: DataCenterRouteContext | null | undefined,
  pageSize: number,
): DataCenterResultQuery {
  return {
    page: 1,
    pageSize,
    ...(context?.taskId ? { taskId: context.taskId } : {}),
    ...(context?.batchId ? { batchId: context.batchId } : {}),
  };
}

export function formatDataCenterResultQuerySummary(query: DataCenterResultQuery): string {
  const scopeParts = [
    query.taskId ? `Task：${query.taskId}` : null,
    query.batchId ? `Batch：${query.batchId}` : null,
  ].filter(Boolean);
  const filterParts = [
    scopeParts.length > 0 ? scopeParts.join(' / ') : '全部结果',
    query.status?.length ? `状态：${query.status.join('、')}` : null,
    query.keyword ? `关键词：${query.keyword}` : null,
    query.createdFrom || query.createdTo
      ? `时间：${formatQueryDate(query.createdFrom)} 至 ${formatQueryDate(query.createdTo)}`
      : null,
    `每页 ${query.pageSize}`,
  ].filter(Boolean);

  return filterParts.join(' / ');
}

function formatQueryDate(value: string | undefined): string {
  return value ? value.slice(0, 10) : '不限';
}
