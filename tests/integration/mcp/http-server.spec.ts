import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { createMcpServer } from '@mcp/server/createMcpServer';
import { startEmbeddedMcpHttpServer } from '@mcp/server/startEmbeddedHttpServer';
import type { ExtractionResult, TaskBatch, TaskFlow } from '@shared/types';

const taskFlow: TaskFlow = {
  id: 'task-http-1',
  name: 'HTTP 抓取任务',
  description: '通过 HTTP 集成测试验证 MCP',
  steps: [
    {
      id: 'step-1',
      name: '打开首页',
      action: { type: 'navigate', url: 'https://example.com' },
    },
  ],
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:05:00.000Z',
};

const batch: TaskBatch = {
  id: 'batch-http-1',
  taskId: 'task-http-1',
  status: 'success',
  createdAt: '2026-04-20T10:10:00.000Z',
  startedAt: '2026-04-20T10:10:05.000Z',
  finishedAt: '2026-04-20T10:12:00.000Z',
  stepResults: [],
};

const results: ExtractionResult[] = [
  {
    id: 'result-http-1',
    taskId: 'task-http-1',
    batchId: 'batch-http-1',
    data: { title: 'HTTP 首页标题' },
    status: 'normal',
    createdAt: '2026-04-20T10:12:05.000Z',
  },
];

let closeCurrent: (() => Promise<void>) | null = null;

describe('mcp http server integration', () => {
  afterEach(async () => {
    if (closeCurrent) {
      await closeCurrent();
      closeCurrent = null;
    }
  });

  it('supports authenticated initialize, listTools and readResource over streamable HTTP', async () => {
    const server = createMcpServer({
      taskService: {
        listTasks: () => [
          {
            id: 'task-http-1',
            name: 'HTTP 抓取任务',
            status: 'completed',
            updatedAt: '2026-04-20T10:05:00.000Z',
            latestBatch: {
              id: 'batch-http-1',
              taskId: 'task-http-1',
              status: 'success',
              createdAt: '2026-04-20T10:10:00.000Z',
              stepResults: [],
            },
          },
        ],
        getTaskDetail: (taskId: string) => (taskId === 'task-http-1' ? taskFlow : null),
        getBatch: (batchId: string) => (batchId === 'batch-http-1' ? batch : null),
      },
      resultService: {
        listResults: ({ taskId } = {}) => (taskId === 'task-http-1' ? results : []),
      },
      executionLogService: {
        query: ({ batchId } = {}) =>
          batchId === 'batch-http-1'
            ? [
                {
                  taskId: 'task-http-1',
                  batchId: 'batch-http-1',
                  level: 'info',
                  message: 'HTTP 日志记录',
                  createdAt: '2026-04-20T10:12:00.000Z',
                },
              ]
            : [],
      },
    });

    const handle = await startEmbeddedMcpHttpServer({
      createServer: () => server,
      host: '127.0.0.1',
      port: 0,
      token: 'http-integration-token',
    });

    closeCurrent = handle.close;

    const client = new Client({
      name: 'yclaw-http-test-client',
      version: '1.0.0',
    });
    const transport = new StreamableHTTPClientTransport(new URL(handle.endpoint), {
      requestInit: {
        headers: {
          Authorization: 'Bearer http-integration-token',
        },
      },
    });

    await client.connect(transport);

    const tools = await client.listTools();
    const taskGetResult = await client.callTool({
      name: 'task.get',
      arguments: { taskId: 'task-http-1' },
    });
    const batchLogsResult = await client.callTool({
      name: 'batch.logs',
      arguments: { batchId: 'batch-http-1', limit: 10 },
    });
    const resultsQueryResult = await client.callTool({
      name: 'results.query',
      arguments: { taskId: 'task-http-1', limit: 10 },
    });
    const taskResource = await client.readResource({ uri: 'yclaw://tasks/task-http-1' });

    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['task.list', 'task.get', 'batch.get', 'batch.logs', 'results.query']),
    );
    expect(taskGetResult.content[0]?.type).toBe('text');
    expect(taskGetResult.content[0]?.text).toContain('"id": "task-http-1"');
    expect(batchLogsResult.content[0]?.type).toBe('text');
    expect(batchLogsResult.content[0]?.text).toContain('HTTP 日志记录');
    expect(resultsQueryResult.content[0]?.type).toBe('text');
    expect(resultsQueryResult.content[0]?.text).toContain('HTTP 首页标题');
    expect(taskResource.contents[0]?.text).toContain('id: task-http-1');

    await transport.close();
  });
});
