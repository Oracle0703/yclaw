import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory';
import { createDesktopMcpServer } from '../../../src/mcp/server/createDesktopMcpServer';
import type { BrowserSession, TaskBatch, TaskFlow } from '@shared/types';

const taskFlow: TaskFlow = {
  id: 'task-1',
  name: '宿主任务',
  entryUrl: 'https://example.com/dashboard',
  sessionId: 'session-1',
  steps: [
    {
      id: 'step-1',
      name: '打开页面',
      action: { type: 'click', selector: '#open' },
    },
  ],
  createdAt: '2026-04-20T13:00:00.000Z',
  updatedAt: '2026-04-20T13:00:00.000Z',
};

const batch: TaskBatch = {
  id: 'batch-1',
  taskId: 'task-1',
  status: 'pending',
  createdAt: '2026-04-20T13:00:10.000Z',
  stepResults: [],
};

const sessionRecord: BrowserSession = {
  id: 'session-1',
  name: '测试会话',
  domain: 'example.com/login',
  partition: 'persist:session_123',
  createdAt: '2026-04-20T13:00:00.000Z',
  updatedAt: '2026-04-20T13:00:00.000Z',
};

function readText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((item) => item.type === 'text');
  if (!block?.text) {
    throw new Error('text block missing');
  }
  return block.text;
}

describe('desktop mcp host', () => {
  const loadURL = vi.fn(async () => undefined);
  const openWindow = vi.fn();
  const startTask = vi.fn((taskId: string) => ({
    taskId,
    status: 'running',
  }));
  const getOrCreateTabBySession = vi.fn(() => ({
    webContents: {
      id: 88,
      loadURL,
    },
  }));
  const info = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes task.run via real desktop host dependencies', async () => {
    const server = createDesktopMcpServer({
      taskService: {
        listTasks: () => [],
        getTaskDetail: () => taskFlow,
        getBatch: () => batch,
        startTask,
      },
      resultService: {
        listResults: () => [],
      },
      executionLogService: {
        query: () => [],
      },
      sessionRegistry: {
        listSessions: () => [sessionRecord],
      },
      tabManager: {
        getOrCreateTabBySession,
      },
      windowManager: {
        openWindow,
      },
      logService: {
        info,
      },
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'yclaw-test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'task.run',
      arguments: { taskId: 'task-1' },
    });

    expect(openWindow).toHaveBeenCalledWith({ module: 'browser' });
    expect(getOrCreateTabBySession).toHaveBeenCalledWith(
      'persist:session_123',
      'https://example.com/dashboard',
    );
    expect(loadURL).toHaveBeenCalledWith('https://example.com/dashboard');
    expect(startTask).toHaveBeenCalledWith('task-1', expect.objectContaining({ id: 88 }));
    expect(info).toHaveBeenCalled();
    expect(JSON.parse(readText(result))).toMatchObject({
      taskId: 'task-1',
      status: 'running',
      webContentsId: 88,
      sessionPartition: 'persist:session_123',
    });
  });

  it('executes session.refresh by reopening session domain in matching partition', async () => {
    const server = createDesktopMcpServer({
      taskService: {
        listTasks: () => [],
        getTaskDetail: () => taskFlow,
        getBatch: () => batch,
        startTask,
      },
      resultService: {
        listResults: () => [],
      },
      executionLogService: {
        query: () => [],
      },
      sessionRegistry: {
        listSessions: () => [sessionRecord],
      },
      tabManager: {
        getOrCreateTabBySession,
      },
      windowManager: {
        openWindow,
      },
      logService: {
        info,
      },
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'yclaw-test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'session.refresh',
      arguments: { sessionId: 'session-1' },
    });

    expect(openWindow).toHaveBeenCalledWith({ module: 'browser' });
    expect(getOrCreateTabBySession).toHaveBeenCalledWith(
      'persist:session_123',
      'https://example.com/login',
    );
    expect(loadURL).toHaveBeenCalledWith('https://example.com/login');
    expect(JSON.parse(readText(result))).toMatchObject({
      sessionId: 'session-1',
      partition: 'persist:session_123',
      domain: 'https://example.com/login',
      webContentsId: 88,
    });
  });
});
