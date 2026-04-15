import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockDb = {
  saveAIConversation: vi.fn(),
  saveAIMessage: vi.fn(),
  deleteAIConversation: vi.fn(() => true),
  getTasks: vi.fn(() => []),
  getInstalledPlugins: vi.fn(() => []),
};

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDb),
  },
}));

import { AIService } from '@main/ai/AIService';

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIService({
      provider: 'openai',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com/v1',
      model: 'gpt-test',
    });
  });

  it('should initialize with default config', () => {
    const s = new AIService();
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

    expect(mockDb.saveAIConversation).toHaveBeenCalledTimes(1);
    expect(mockDb.saveAIMessage).toHaveBeenCalledTimes(2);
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

    expect(mockDb.deleteAIConversation).toHaveBeenCalledWith(response.conversationId);
  });

  it('should return prompt without API key warning', async () => {
    const noKeyService = new AIService({
      provider: 'openai',
      apiKey: '',
    });

    const response = await noKeyService.chat({ message: 'hello' });
    expect(response.message.content).toContain('API Key');
  });
});
