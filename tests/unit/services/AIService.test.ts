import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextManager } from '@main/ai/ContextManager';
import { ToolRegistry } from '@main/ai/ToolRegistry';

// Mock os module
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

// Mock fetch for LLM calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockTaskRepository = {
  getTasks: vi.fn(() => []),
};

const mockPluginRepository = {
  getInstalledPlugins: vi.fn(() => []),
};

const mockAIRepository = {
  saveAIConversation: vi.fn(),
  saveAIMessage: vi.fn(),
  deleteAIConversation: vi.fn(() => true),
};

import { AIService } from '@main/ai/AIService';

describe('AIService', () => {
  let service: AIService;
  let contextManager: ContextManager;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    contextManager = new ContextManager({
      taskRepository: mockTaskRepository,
      pluginRepository: mockPluginRepository,
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

  it('should require context manager injection', () => {
    expect(
      () =>
        new AIService({
          aiRepository: mockAIRepository,
          taskRepository: mockTaskRepository,
        }),
    ).toThrowError('contextManager is required');
  });

  it('should require ai repository injection', () => {
    expect(
      () =>
        new AIService({
          taskRepository: mockTaskRepository,
          contextManager,
        }),
    ).toThrowError('aiRepository is required');
  });

  it('should require task repository injection', () => {
    expect(
      () =>
        new AIService({
          aiRepository: mockAIRepository,
          contextManager,
        }),
    ).toThrowError('taskRepository is required');
  });

  it('should require tool registry injection', () => {
    expect(
      () =>
        new AIService({
          aiRepository: mockAIRepository,
          taskRepository: mockTaskRepository,
          contextManager,
        }),
    ).toThrowError('toolRegistry is required');
  });

  it('should initialize with default config', () => {
    const s = new AIService({
      aiRepository: mockAIRepository,
      taskRepository: mockTaskRepository,
      contextManager,
      toolRegistry: new ToolRegistry(),
    });
    const config = s.getConfig();
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-3.5-turbo');
  });

  it('should update config', () => {
    service.updateConfig({ model: 'gpt-4' });
    expect(service.getConfig().model).toBe('gpt-4');
  });

  it('should register built-in tools', () => {
    const tools = service.getToolRegistry().list();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('task_list');
    expect(toolNames).toContain('system_status');
    expect(toolNames).toContain('navigate');
  });

  it('should execute task_list tool via injected task repository', async () => {
    mockTaskRepository.getTasks.mockReturnValueOnce([
      { id: 'task-1', name: '任务一', status: 'running', updatedAt: '2026-04-17 14:00:00' },
      { id: 'task-2', name: '任务二', status: 'completed', updatedAt: '2026-04-17 14:05:00' },
    ]);

    const result = await service.getToolRegistry().execute('task_list', {}, {
      currentModule: 'workbench',
      systemMetrics: { cpu: 0, memory: 0, disk: 0, uptime: 0 },
      recentTasks: [],
      installedPlugins: [],
    });

    expect(result.success).toBe(true);
    expect(mockTaskRepository.getTasks).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({
      summary: {
        total: 2,
        running: 1,
        success: 1,
      },
    });
  });

  it('should handle chat and return response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '你好，很高兴帮助你！' } }],
        }),
    });

    const response = await service.chat({ message: '你好' });

    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toBe('你好，很高兴帮助你！');
    expect(response.conversationId).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should include available tools and call protocol in system prompt', async () => {
    toolRegistry.register({
      name: 'mcp.mock.echo',
      description: '回显输入',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
      },
      confirmationLevel: 0,
      source: 'mcp:mock',
      execute: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '无需工具' } }],
        }),
    });

    await service.chat({ message: '有哪些工具？' });

    const requestBody = JSON.parse(String(mockFetch.mock.calls[0][1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMessage = requestBody.messages.find((message) => message.role === 'system');
    expect(systemMessage?.content).toContain('## 可用工具');
    expect(systemMessage?.content).toContain('mcp.mock.echo');
    expect(systemMessage?.content).toContain('YCLAW_TOOL_CALL');
  });

  it('should execute a safe tool when the model returns a tool call directive', async () => {
    const execute = vi.fn(async () => ({
      success: true,
      data: {
        text: 'pong',
      },
    }));
    toolRegistry.register({
      name: 'mcp.mock.echo',
      description: '回显输入',
      parameters: {},
      confirmationLevel: 0,
      source: 'mcp:mock',
      execute,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: 'YCLAW_TOOL_CALL {"name":"mcp.mock.echo","params":{"text":"ping"}}',
              },
            },
          ],
        }),
    });

    const response = await service.chat({ message: '调用 echo' });

    expect(execute).toHaveBeenCalledWith(
      {
        text: 'ping',
      },
      expect.objectContaining({
        currentModule: 'workbench',
      }),
    );
    expect(response.executedToolCall).toEqual({
      name: 'mcp.mock.echo',
      params: {
        text: 'ping',
      },
    });
    expect(response.message.content).toContain('已调用工具：mcp.mock.echo');
    expect(response.message.content).toContain('"text": "pong"');
  });

  it('should require confirmation and skip execution for dangerous tool directives', async () => {
    const execute = vi.fn();
    toolRegistry.register({
      name: 'mcp.mock.danger',
      description: '危险操作',
      parameters: {},
      confirmationLevel: 2,
      source: 'mcp:mock',
      execute,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: 'YCLAW_TOOL_CALL {"name":"mcp.mock.danger","params":{"action":"refresh"}}',
              },
            },
          ],
        }),
    });

    const response = await service.chat({ message: '执行危险工具' });

    expect(execute).not.toHaveBeenCalled();
    expect(response.message.content).toContain('工具 mcp.mock.danger 需要用户确认');
    expect(response.message.content).toContain('"action": "refresh"');
    expect(response.pendingToolCall).toEqual({
      name: 'mcp.mock.danger',
      params: {
        action: 'refresh',
      },
    });
  });

  it('should maintain conversation history', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '回复' } }],
        }),
    });

    const r1 = await service.chat({ message: '第一条消息' });
    const r2 = await service.chat({
      message: '第二条消息',
      conversationId: r1.conversationId,
    });

    expect(r1.conversationId).toBe(r2.conversationId);

    const conversations = service.listConversations();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].messages).toHaveLength(4); // 2 user + 2 assistant
  });

  it('should handle LLM API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const response = await service.chat({ message: 'test' });
    expect(response.message.content).toContain('AI 服务调用失败');
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const response = await service.chat({ message: 'test' });
    expect(response.message.content).toContain('AI 服务调用失败');
    expect(response.message.content).toContain('Network error');
  });

  it('should delete conversations', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'ok' } }],
        }),
    });

    const r = await service.chat({ message: 'test' });
    expect(service.listConversations()).toHaveLength(1);

    const deleted = service.deleteConversation(r.conversationId);
    expect(deleted).toBe(true);
    expect(service.listConversations()).toHaveLength(0);
  });

  it('should persist conversation and messages to database', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '已记录到数据库' } }],
        }),
    });

    await service.chat({ message: '请记录这段对话' });

    expect(mockAIRepository.saveAIConversation).toHaveBeenCalledTimes(1);
    expect(mockAIRepository.saveAIMessage).toHaveBeenCalledTimes(2);
  });

  it('should delete persisted conversation from database', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'ok' } }],
        }),
    });

    const response = await service.chat({ message: '待删除会话' });
    service.deleteConversation(response.conversationId);

    expect(mockAIRepository.deleteAIConversation).toHaveBeenCalledWith(response.conversationId);
  });

  it('should return prompt without API key warning', async () => {
    const noKeyService = new AIService({
      provider: 'openai',
      apiKey: '',
      aiRepository: mockAIRepository,
      taskRepository: mockTaskRepository,
      contextManager,
      toolRegistry: new ToolRegistry(),
    });

    const response = await noKeyService.chat({ message: 'hello' });
    expect(response.message.content).toContain('API Key');
  });
});
