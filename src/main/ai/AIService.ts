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
import type { ContextManager } from './ContextManager';
import { OpenAIProvider, OllamaProvider } from './LLMProvider';
import { ToolRegistry } from './ToolRegistry';
import { createTaskListTool } from './tools/taskTools';
import { systemStatusTool } from './tools/systemTools';
import { navigateTool, createNavigateTool } from './tools/navigateTools';
import type { LLMProvider } from './types';
import type { AIRepository, TaskRepository } from '../services/repositories';

import crypto from 'crypto';

export interface AIServiceOptions {
  config?: Partial<AIConfig>;
  openWindow?: (module: string) => void;
  contextManager?: ContextManager;
  toolRegistry?: ToolRegistry;
  aiRepository?: Pick<AIRepository, 'saveAIConversation' | 'saveAIMessage' | 'deleteAIConversation'>;
  taskRepository?: Pick<TaskRepository, 'getTasks'>;
}

export class AIService {
  private provider: LLMProvider;
  private contextManager: ContextManager;
  private toolRegistry: ToolRegistry;
  private conversations = new Map<string, Conversation>();
  private config: AIConfig;
  private aiRepository: Pick<AIRepository, 'saveAIConversation' | 'saveAIMessage' | 'deleteAIConversation'>;
  private taskRepository: Pick<TaskRepository, 'getTasks'>;

  constructor(configOrOptions?: Partial<AIConfig> | AIServiceOptions) {
    const opts = this.normalizeOptions(configOrOptions);

    this.config = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2048,
      ...opts.config,
    };

    if (!opts.contextManager) {
      throw new Error('contextManager is required');
    }

    if (!opts.aiRepository) {
      throw new Error('aiRepository is required');
    }

    if (!opts.taskRepository) {
      throw new Error('taskRepository is required');
    }

    if (!opts.toolRegistry) {
      throw new Error('toolRegistry is required');
    }

    this.provider = this.createProvider(this.config);
    this.contextManager = opts.contextManager;
    this.aiRepository = opts.aiRepository;
    this.taskRepository = opts.taskRepository;
    this.toolRegistry = opts.toolRegistry;

    // Register built-in tools
    this.toolRegistry.register(createTaskListTool(this.taskRepository));
    this.toolRegistry.register(systemStatusTool);
    if (opts.openWindow) {
      this.toolRegistry.register(createNavigateTool(opts.openWindow));
    } else {
      this.toolRegistry.register(navigateTool);
    }
  }

  private normalizeOptions(configOrOptions?: Partial<AIConfig> | AIServiceOptions): AIServiceOptions {
    if (!configOrOptions) {
      return {};
    }

    const optionKeys: Array<keyof AIServiceOptions> = [
      'config',
      'openWindow',
      'contextManager',
      'toolRegistry',
      'aiRepository',
      'taskRepository',
    ];
    const hasOptionKeys = optionKeys.some((key) => key in configOrOptions);

    if (!hasOptionKeys) {
      return { config: configOrOptions as Partial<AIConfig> };
    }

    const rawOptions = configOrOptions as AIServiceOptions & Partial<AIConfig>;
    const {
      config,
      openWindow,
      contextManager,
      toolRegistry,
      aiRepository,
      taskRepository,
      ...directConfig
    } = rawOptions;

    return {
      config: {
        ...directConfig,
        ...config,
      },
      openWindow,
      contextManager,
      toolRegistry,
      aiRepository,
      taskRepository,
    };
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
    this.aiRepository.saveAIMessage(conversationId, userMessage);

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
    this.aiRepository.saveAIConversation(conversation);
    this.aiRepository.saveAIMessage(conversationId, assistantMessage);

    return {
      message: assistantMessage,
      conversationId,
    };
  }

  listConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  deleteConversation(id: string): boolean {
    const removed = this.conversations.delete(id);
    const deletedFromDb = this.aiRepository.deleteAIConversation(id);
    return removed || deletedFromDb;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
