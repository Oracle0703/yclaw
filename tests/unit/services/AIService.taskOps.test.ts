import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextManager } from '@main/ai/ContextManager';
import { ToolRegistry } from '@main/ai/ToolRegistry';

vi.mock('os', () => ({
  default: {
    cpus: () => [{ times: { user: 4000, nice: 0, sys: 1000, idle: 5000, irq: 0 } }],
    totalmem: () => 8 * 1024 * 1024 * 1024,
    freemem: () => 3 * 1024 * 1024 * 1024,
    uptime: () => 7200,
  },
  cpus: () => [{ times: { user: 4000, nice: 0, sys: 1000, idle: 5000, irq: 0 } }],
  totalmem: () => 8 * 1024 * 1024 * 1024,
  freemem: () => 3 * 1024 * 1024 * 1024,
  uptime: () => 7200,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockTaskRepository = {
  getTasks: vi.fn(() => [
    { id: 'task-1', name: '价格采集', status: 'failed', updatedAt: '2026-04-21T10:00:00.000Z' },
  ]),
};

const mockPluginRepository = {
  getInstalledPlugins: vi.fn(() => []),
};

const mockAIRepository = {
  saveAIConversation: vi.fn(),
  saveAIMessage: vi.fn(),
  deleteAIConversation: vi.fn(() => true),
};

const mockTaskOpsContextProvider = {
  collect: vi.fn(() => ({
    workspaces: [{ id: 'workspace-1', name: '电商巡检组' }],
    tasks: [
      {
        id: 'task-1',
        name: '价格采集',
        status: 'failed',
        updatedAt: '2026-04-21T10:00:00.000Z',
      },
    ],
    alerts: [
      {
        id: 'alert-1',
        taskId: 'task-1',
        message: '任务失败',
        createdAt: '2026-04-21T10:05:00.000Z',
        read: false,
        status: 'claimed',
        level: 'critical',
      },
    ],
    reviews: [
      {
        id: 'review-1',
        taskId: 'task-1',
        reviewType: 'failure',
        conclusion: '更新模板选择器',
        followUpActions: ['update-template'],
        createdAt: '2026-04-21T10:10:00.000Z',
      },
    ],
    runners: [
      {
        id: 'runner-1',
        name: 'runner-a',
        kind: 'remote',
        status: 'online',
        runningCount: 2,
        maxConcurrency: 4,
      },
    ],
    results: [
      {
        taskId: 'task-1',
        batchId: 'batch-1',
        status: 'failed',
        qualityStatus: 'failed',
      },
    ],
  })),
};

import { AIService } from '@main/ai/AIService';

describe('AIService task operations tools', () => {
  let service: AIService;
  let contextManager: ContextManager;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    contextManager = new ContextManager({
      taskRepository: mockTaskRepository,
      pluginRepository: mockPluginRepository,
      taskOpsContextProvider: mockTaskOpsContextProvider,
    });
    toolRegistry = new ToolRegistry();
    service = new AIService({
      provider: 'openai',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com/v1',
      model: 'gpt-test',
      aiRepository: mockAIRepository,
      taskRepository: mockTaskRepository,
      contextManager,
      toolRegistry,
    });
  });

  it('registers task operations copilot tools', () => {
    const toolNames = service.getToolRegistry().list().map((tool) => tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        'ops_task_summary',
        'ops_alert_summary',
        'ops_runner_status',
        'ops_review_draft',
      ]),
    );
  });

  it('includes task operations context in the system prompt', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '已读取中台上下文' } }],
        }),
    });

    await service.chat({ message: '给我一份中台摘要' });

    const requestBody = JSON.parse(String(mockFetch.mock.calls[0][1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMessage = requestBody.messages.find((message) => message.role === 'system');

    expect(systemMessage?.content).toContain('任务运营中台');
    expect(systemMessage?.content).toContain('待处理告警');
    expect(systemMessage?.content).toContain('复盘记录');
  });
});
