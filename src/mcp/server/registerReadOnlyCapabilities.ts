import { stringify } from 'yaml';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types';
import {
  batchGetInputSchema,
  batchLogsInputSchema,
  hotLatestInputSchema,
  hotSummaryInputSchema,
  hotTrendsInputSchema,
  resultsQueryInputSchema,
  taskGetInputSchema,
  taskListInputSchema,
} from '../shared/schemas';
import {
  buildBatchLogsResourceUri,
  buildBatchResourceUri,
  buildResultsResourceUri,
  buildTaskResourceUri,
  listDiscoverableResources,
  parseResourceUri,
} from '../shared/resources';
import type { CreateMcpServerOptions } from '../shared/types';

function createJsonToolResult(payload: unknown): CallToolResult {
  const text = JSON.stringify(payload, null, 2);
  return {
    content: [{ type: 'text', text }],
  };
}

function createErrorToolResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function createTextResourceResult(uri: string, text: string, mimeType: string): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        text,
        mimeType,
      },
    ],
  };
}

function trimToLimit<T>(items: T[], limit?: number): T[] {
  if (!limit || limit <= 0) {
    return items;
  }
  return items.slice(0, limit);
}

// The SDK's registerTool signature involves deeply nested generics that, under
// CommonJS resolution, can trigger TS2589 ("excessively deep"). Casting through
// a narrower interface preserves runtime behaviour while breaking inference.
interface RelaxedRegisterServer {
  registerTool: (
    name: string,
    options: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<unknown>,
  ) => unknown;
  registerResource: McpServer['registerResource'];
}

export function registerReadOnlyCapabilities(
  serverInput: McpServer,
  options: CreateMcpServerOptions,
): void {
  const server = serverInput as unknown as RelaxedRegisterServer;
  server.registerTool(
    'task.list',
    {
      title: '列出任务',
      description: '列出当前任务与最近批次摘要。',
      inputSchema: taskListInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ status, tag }) => {
      const items = options.taskService.listTasks().filter((task) => {
        if (status && task.status !== status) {
          return false;
        }
        if (tag) {
          // Tag filtering is not yet supported by TaskSummary; reserved for
          // future use once tag metadata is surfaced through the service layer.
          return true;
        }
        return true;
      });
      return createJsonToolResult({ total: items.length, items });
    },
  );

  server.registerTool(
    'task.get',
    {
      title: '读取任务详情',
      description: '按 taskId 返回任务完整定义。',
      inputSchema: taskGetInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ taskId }) => {
      const task = options.taskService.getTaskDetail(taskId);
      if (!task) {
        return createErrorToolResult(`Task "${taskId}" not found`);
      }
      return createJsonToolResult(task);
    },
  );

  server.registerTool(
    'batch.get',
    {
      title: '读取批次状态',
      description: '按 batchId 返回批次状态。',
      inputSchema: batchGetInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ batchId }) => {
      const batch = options.taskService.getBatch(batchId);
      if (!batch) {
        return createErrorToolResult(`Batch "${batchId}" not found`);
      }
      return createJsonToolResult(batch);
    },
  );

  server.registerTool(
    'batch.logs',
    {
      title: '读取批次日志',
      description: '返回指定批次的结构化执行日志。',
      inputSchema: batchLogsInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ batchId, limit, since }) => {
      const items = trimToLimit(
        options.executionLogService.query({ batchId, since }),
        limit ?? 50,
      );
      return createJsonToolResult(items);
    },
  );

  server.registerTool(
    'results.query',
    {
      title: '查询结果集',
      description: '按 taskId 或 batchId 查询结构化结果。',
      inputSchema: resultsQueryInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ taskId, batchId, limit }) => {
      const items = trimToLimit(
        options.resultService.listResults({ taskId, batchId }),
        limit ?? 50,
      );
      return createJsonToolResult(items);
    },
  );

  server.registerTool(
    'hot.latest',
    {
      title: '查询最新热点',
      description: '按来源或关键词查询最新热点结果。',
      inputSchema: hotLatestInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ sourceId, keyword, limit }) => {
      const items = trimToLimit(
        listHotResults(options)
          .filter((result) => {
            if (sourceId && result.data.sourceId !== sourceId) {
              return false;
            }
            if (keyword && !JSON.stringify(result.data).toLowerCase().includes(String(keyword).toLowerCase())) {
              return false;
            }
            return true;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        limit ?? 50,
      );
      return createJsonToolResult({ total: items.length, items });
    },
  );

  server.registerTool(
    'hot.trends',
    {
      title: '查询热点趋势',
      description: '按关键词组和来源聚合热点数量。',
      inputSchema: hotTrendsInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ limit }) => createJsonToolResult(buildHotTrends(listHotResults(options), limit ?? 20)),
  );

  server.registerTool(
    'hot.summary',
    {
      title: '生成热点摘要',
      description: '返回适合 AI 或 MCP 客户端展示的热点文本摘要。',
      inputSchema: hotSummaryInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ keyword, limit }) => {
      const items = trimToLimit(
        listHotResults(options).filter((result) =>
          keyword ? JSON.stringify(result.data).toLowerCase().includes(String(keyword).toLowerCase()) : true,
        ),
        limit ?? 20,
      );
      return {
        content: [{
          type: 'text',
          text: items.length === 0
            ? '暂无匹配热点。'
            : items.map((result, index) =>
              `${index + 1}. ${String(result.data.title ?? result.id)} ${String(result.data.url ?? '')}`,
            ).join('\n'),
        }],
      };
    },
  );

  for (const resource of listDiscoverableResources(options.taskService.listTasks())) {
    server.registerResource(
      `discoverable:${resource.uri}`,
      resource.uri,
      {
        title: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri) => readResource(uri, options),
    );
  }

  server.registerResource(
    'task-template',
    new ResourceTemplate('yclaw://tasks/{taskId}', { list: undefined }),
    {
      title: '任务定义',
      description: '按任务 ID 读取任务 YAML。',
      mimeType: 'application/yaml',
    },
    async (uri) => readResource(uri, options),
  );

  server.registerResource(
    'batch-template',
    new ResourceTemplate('yclaw://batches/{batchId}', { list: undefined }),
    {
      title: '批次状态',
      description: '按批次 ID 读取批次 JSON。',
      mimeType: 'application/json',
    },
    async (uri) => readResource(uri, options),
  );

  server.registerResource(
    'batch-logs-template',
    new ResourceTemplate('yclaw://batches/{batchId}/logs', { list: undefined }),
    {
      title: '批次日志',
      description: '按批次 ID 读取 NDJSON 日志。',
      mimeType: 'application/x-ndjson',
    },
    async (uri) => readResource(uri, options),
  );

  server.registerResource(
    'results-template',
    new ResourceTemplate('yclaw://results/{taskId}', { list: undefined }),
    {
      title: '结果集',
      description: '按任务 ID 读取 NDJSON 结果。',
      mimeType: 'application/x-ndjson',
    },
    async (uri) => readResource(uri, options),
  );
}

function listHotResults(options: CreateMcpServerOptions) {
  return options.resultService.listResults({}).filter((result) => {
    const data = result.data;
    return Boolean(data.title) && (
      data.rank !== undefined
      || data.sourceId !== undefined
      || data.keywordGroups !== undefined
      || data.isNew !== undefined
      || data.url !== undefined
    );
  });
}

function buildHotTrends(results: ReturnType<typeof listHotResults>, limit: number) {
  return {
    keywordGroups: topCounts(
      results.flatMap((result) =>
        Array.isArray(result.data.keywordGroups) ? result.data.keywordGroups.map(String) : [],
      ),
      limit,
    ),
    sources: topCounts(
      results.map((result) => String(result.data.sourceId ?? 'unknown')),
      limit,
    ),
  };
}

function topCounts(values: string[], limit: number): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

async function readResource(uri: URL, options: CreateMcpServerOptions): Promise<ReadResourceResult> {
  const descriptor = parseResourceUri(uri.toString());

  switch (descriptor.kind) {
    case 'task': {
      const task = options.taskService.getTaskDetail(descriptor.taskId);
      if (!task) {
        throw new Error(`Task "${descriptor.taskId}" not found`);
      }
      return createTextResourceResult(
        buildTaskResourceUri(descriptor.taskId),
        stringify(task),
        'application/yaml',
      );
    }
    case 'batch': {
      const batch = options.taskService.getBatch(descriptor.batchId);
      if (!batch) {
        throw new Error(`Batch "${descriptor.batchId}" not found`);
      }
      return createTextResourceResult(
        buildBatchResourceUri(descriptor.batchId),
        JSON.stringify(batch, null, 2),
        'application/json',
      );
    }
    case 'batchLogs': {
      const lines = options.executionLogService
        .query({ batchId: descriptor.batchId })
        .map((record) => JSON.stringify(record))
        .join('\n');
      return createTextResourceResult(
        buildBatchLogsResourceUri(descriptor.batchId),
        lines,
        'application/x-ndjson',
      );
    }
    case 'results': {
      const lines = options.resultService
        .listResults({ taskId: descriptor.taskId })
        .filter((result) => {
          if (!descriptor.since) {
            return true;
          }
          return result.createdAt >= descriptor.since;
        })
        .slice(0, descriptor.limit)
        .map((record) => JSON.stringify(record))
        .join('\n');
      return createTextResourceResult(
        buildResultsResourceUri(descriptor.taskId, descriptor.limit, descriptor.since),
        lines,
        'application/x-ndjson',
      );
    }
    default: {
      throw new Error(`Unsupported resource URI: ${uri.toString()}`);
    }
  }
}
