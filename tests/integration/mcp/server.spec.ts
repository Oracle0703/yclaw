import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory';
import { createMcpServer } from '../../../src/mcp/server/createMcpServer';
import type { ExtractionResult, TaskBatch, TaskFlow } from '@shared/types';

const taskFlow: TaskFlow = {
  id: 'task-1',
  name: '抓取首页',
  description: '测试任务',
  steps: [
    {
      id: 'step-1',
      name: '点击按钮',
      action: { type: 'click', selector: '#submit' },
    },
  ],
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:05:00.000Z',
};

const batch: TaskBatch = {
  id: 'batch-1',
  taskId: 'task-1',
  status: 'success',
  createdAt: '2026-04-20T10:10:00.000Z',
  startedAt: '2026-04-20T10:10:05.000Z',
  finishedAt: '2026-04-20T10:12:00.000Z',
  stepResults: [],
};

const results: ExtractionResult[] = [
  {
    id: 'result-1',
    taskId: 'task-1',
    batchId: 'batch-1',
    data: { title: '首页标题' },
    status: 'normal',
    createdAt: '2026-04-20T10:12:05.000Z',
  },
];

const taskSummaries = [
  {
    id: 'task-1',
    name: '抓取首页',
    status: 'completed',
    updatedAt: '2026-04-20T10:05:00.000Z',
    latestBatch: {
      id: 'batch-1',
      taskId: 'task-1',
      status: 'success',
      createdAt: '2026-04-20T10:10:00.000Z',
      stepResults: [],
    },
  },
];

function readTextBlock(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((item) => item.type === 'text');
  if (!block?.text) {
    throw new Error('Missing text content block');
  }
  return block.text;
}

describe('mcp server integration', () => {
  beforeEach(() => {
    process.env.YCLAW_MCP_TOKEN = '';
  });

  it('lists read-only tools and discoverable resources', async () => {
    const server = createMcpServer({
      taskService: {
        listTasks: () => taskSummaries,
        getTaskDetail: () => taskFlow,
        getBatch: () => batch,
      },
      resultService: {
        listResults: () => results,
      },
      executionLogService: {
        query: () => [
          {
            taskId: 'task-1',
            batchId: 'batch-1',
            level: 'info',
            message: '任务完成',
            createdAt: '2026-04-20T10:12:00.000Z',
          },
        ],
      },
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'yclaw-test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const resources = await client.listResources();

    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['task.list', 'task.get', 'batch.get', 'batch.logs', 'results.query']),
    );
    expect(resources.resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining([
        'yclaw://tasks/task-1',
        'yclaw://batches/batch-1',
        'yclaw://batches/batch-1/logs',
        'yclaw://results/task-1?limit=20',
      ]),
    );
  });

  it('supports tools/call and resources/read for read-only capabilities', async () => {
    const server = createMcpServer({
      taskService: {
        listTasks: () => taskSummaries,
        getTaskDetail: () => taskFlow,
        getBatch: () => batch,
      },
      resultService: {
        listResults: ({ taskId }) => (taskId === 'task-1' ? results : []),
      },
      executionLogService: {
        query: ({ batchId }) =>
          batchId === 'batch-1'
            ? [
                {
                  taskId: 'task-1',
                  batchId: 'batch-1',
                  level: 'info',
                  message: '第一页日志',
                  createdAt: '2026-04-20T10:11:00.000Z',
                },
                {
                  taskId: 'task-1',
                  batchId: 'batch-1',
                  level: 'info',
                  message: '第二页日志',
                  createdAt: '2026-04-20T10:12:00.000Z',
                },
              ]
            : [],
      },
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'yclaw-test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const taskListResult = await client.callTool({ name: 'task.list', arguments: {} });
    const taskGetResult = await client.callTool({
      name: 'task.get',
      arguments: { taskId: 'task-1' },
    });
    const batchLogsResult = await client.callTool({
      name: 'batch.logs',
      arguments: { batchId: 'batch-1', limit: 10 },
    });
    const taskResource = await client.readResource({ uri: 'yclaw://tasks/task-1' });
    const logResource = await client.readResource({ uri: 'yclaw://batches/batch-1/logs' });

    expect(JSON.parse(readTextBlock(taskListResult))).toMatchObject({
      total: 1,
      items: [{ id: 'task-1' }],
    });
    expect(JSON.parse(readTextBlock(taskGetResult))).toMatchObject({
      id: 'task-1',
      name: '抓取首页',
    });
    expect(JSON.parse(readTextBlock(batchLogsResult))).toHaveLength(2);
    expect(taskResource.contents[0]?.text).toContain('id: task-1');
    expect(logResource.contents[0]?.text).toContain('第一页日志');
  });

  it('registers dangerous write tools when host callbacks are provided', async () => {
    const runTask = vi.fn(async (taskId: string) => ({
      taskId,
      batchId: 'batch-write-1',
      status: 'queued',
    }));
    const refreshSession = vi.fn(async (sessionId: string) => ({
      sessionId,
      status: 'refreshed',
      refreshedAt: '2026-04-20T12:20:00.000Z',
    }));
    const audit = vi.fn();

    const server = createMcpServer({
      taskService: {
        listTasks: () => taskSummaries,
        getTaskDetail: () => taskFlow,
        getBatch: () => batch,
      },
      resultService: {
        listResults: () => results,
      },
      executionLogService: {
        query: () => [],
      },
      dangerousActions: {
        runTask,
        refreshSession,
      },
      auditLogger: audit,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'yclaw-test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const taskRunTool = tools.tools.find((tool) => tool.name === 'task.run');
    const sessionRefreshTool = tools.tools.find((tool) => tool.name === 'session.refresh');

    expect(taskRunTool?.annotations?.destructiveHint).toBe(true);
    expect(taskRunTool?._meta).toMatchObject({ dangerous: true });
    expect(sessionRefreshTool?.annotations?.destructiveHint).toBe(true);
    expect(sessionRefreshTool?._meta).toMatchObject({ dangerous: true });

    const runResult = await client.callTool({
      name: 'task.run',
      arguments: { taskId: 'task-1' },
    });
    const refreshResult = await client.callTool({
      name: 'session.refresh',
      arguments: { sessionId: 'session-1' },
    });

    expect(runTask).toHaveBeenCalledWith('task-1');
    expect(refreshSession).toHaveBeenCalledWith('session-1');
    expect(audit).toHaveBeenCalledTimes(2);
    expect(JSON.parse(readTextBlock(runResult))).toMatchObject({
      batchId: 'batch-write-1',
      status: 'queued',
    });
    expect(JSON.parse(readTextBlock(refreshResult))).toMatchObject({
      sessionId: 'session-1',
      status: 'refreshed',
    });
  });
});
