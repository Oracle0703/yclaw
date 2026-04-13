/**
 * AIService — AI 运营助手核心调度服务
 *
 * 串联 Context → LLM → Response 的主流程
 */

import type {
  AIConfig,
  AIChatRequest,
  AIChatResponse,
  ChatMessage,
  Conversation,
} from '@shared/types';
import { ContextManager } from './ContextManager';
import { OpenAIProvider, OllamaProvider } from './LLMProvider';
import { ToolRegistry } from './ToolRegistry';
import { taskListTool } from './tools/taskTools';
import { systemStatusTool } from './tools/systemTools';
import { navigateTool } from './tools/navigateTools';
import type { LLMProvider } from './types';

export class AIService {
  private provider: LLMProvider;
  private contextManager: ContextManager;
  private toolRegistry: ToolRegistry;
  private conversations = new Map<string, Conversation>();
  private config: AIConfig;

  constructor(config?: Partial<AIConfig>) {
    this.config = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2048,
      ...config,
    };

    this.provider = this.createProvider(this.config);
    this.contextManager = new ContextManager();
    this.toolRegistry = new ToolRegistry();

    // Register built-in tools
    this.toolRegistry.register(taskListTool);
    this.toolRegistry.register(systemStatusTool);
    this.toolRegistry.register(navigateTool);
  }

  private createProvider(config: AIConfig): LLMProvider {
    switch (config.provider) {
      case 'ollama':
        return new OllamaProvider(config.baseUrl, config.model);
      case 'openai':
      case 'custom':
      default:
        return new OpenAIProvider({
          apiKey: config.apiKey ?? '',
          baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
          model: config.model ?? 'gpt-3.5-turbo',
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 2048,
        });
    }
  }

  updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
    this.provider = this.createProvider(this.config);
  }

  getConfig(): AIConfig {
    return { ...this.config };
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const conversationId = request.conversationId ?? this.generateId();
    let conversation = this.conversations.get(conversationId);

    if (!conversation) {
      conversation = {
        id: conversationId,
        title: request.message.slice(0, 30),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.conversations.set(conversationId, conversation);
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: request.message,
      timestamp: Date.now(),
    };
    conversation.messages.push(userMessage);

    // Collect context and build system prompt
    const context = await this.contextManager.collectContext();
    const systemPrompt = this.contextManager.contextToPrompt(context);

    // Call LLM
    let responseContent: string;
    try {
      responseContent = await this.provider.chat(conversation.messages, systemPrompt);
    } catch (error) {
      responseContent = `抱歉，AI 服务调用失败: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Add assistant message
    const assistantMessage: ChatMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: responseContent,
      timestamp: Date.now(),
    };
    conversation.messages.push(assistantMessage);
    conversation.updatedAt = Date.now();

    return {
      message: assistantMessage,
      conversationId,
    };
  }

  listConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
