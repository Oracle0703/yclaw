import { stringify } from 'yaml';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types';
import {
  batchGetInputSchema,
  batchLogsInputSchema,
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
