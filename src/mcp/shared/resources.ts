import type { Resource } from '@modelcontextprotocol/sdk/types';
import type { TaskSummary } from '@main/services/TaskService';

export type YClawResourceDescriptor =
  | { kind: 'task'; taskId: string }
  | { kind: 'batch'; batchId: string }
  | { kind: 'batchLogs'; batchId: string }
  | { kind: 'results'; taskId: string; limit: number; since?: string };

export function buildTaskResourceUri(taskId: string): string {
  return `yclaw://tasks/${encodeURIComponent(taskId)}`;
}

export function buildBatchResourceUri(batchId: string): string {
  return `yclaw://batches/${encodeURIComponent(batchId)}`;
}

export function buildBatchLogsResourceUri(batchId: string): string {
  return `yclaw://batches/${encodeURIComponent(batchId)}/logs`;
}

export function buildResultsResourceUri(taskId: string, limit = 20, since?: string): string {
  const query = new URLSearchParams();
  query.set('limit', String(limit));
  if (since) {
    query.set('since', since);
  }
  return `yclaw://results/${encodeURIComponent(taskId)}?${query.toString()}`;
}

export function parseResourceUri(uri: string): YClawResourceDescriptor {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  if (parsed.protocol !== 'yclaw:') {
    throw new Error(`Unsupported resource scheme: ${parsed.protocol}`);
  }

  const collection = parsed.hostname;
  const segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (collection === 'tasks' && segments.length === 1) {
    return { kind: 'task', taskId: segments[0]! };
  }

  if (collection === 'batches' && segments.length === 1) {
    return { kind: 'batch', batchId: segments[0]! };
  }

  if (collection === 'batches' && segments.length === 2 && segments[1] === 'logs') {
    return { kind: 'batchLogs', batchId: segments[0]! };
  }

  if (collection === 'results' && segments.length === 1) {
    const limit = Number.parseInt(parsed.searchParams.get('limit') ?? '20', 10);
    const since = parsed.searchParams.get('since') ?? undefined;
    return {
      kind: 'results',
      taskId: segments[0]!,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
      since,
    };
  }

  throw new Error(`Unsupported resource URI: ${uri}`);
}

export function listDiscoverableResources(tasks: TaskSummary[]): Resource[] {
  const resources: Resource[] = [];

  for (const task of tasks) {
    resources.push({
      uri: buildTaskResourceUri(task.id),
      name: `任务 · ${task.name}`,
      description: '任务定义 YAML',
      mimeType: 'application/yaml',
    });
    resources.push({
      uri: buildResultsResourceUri(task.id),
      name: `结果集 · ${task.name}`,
      description: '任务结果 NDJSON',
      mimeType: 'application/x-ndjson',
    });

    if (task.latestBatch) {
      resources.push({
        uri: buildBatchResourceUri(task.latestBatch.id),
        name: `批次 · ${task.latestBatch.id}`,
        description: '批次状态 JSON',
        mimeType: 'application/json',
      });
      resources.push({
        uri: buildBatchLogsResourceUri(task.latestBatch.id),
        name: `批次日志 · ${task.latestBatch.id}`,
        description: '批次日志 NDJSON',
        mimeType: 'application/x-ndjson',
      });
    }
  }

  return resources;
}
