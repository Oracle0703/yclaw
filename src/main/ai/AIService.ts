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
  AIServiceContext,
  AIToolDef,
  ToolResult,
  AIToolCall,
  AIPendingToolCall,
} from '@shared/types';
import type { ContextManager } from './ContextManager';
import { OpenAIProvider, OllamaProvider } from './LLMProvider';
import { ToolRegistry } from './ToolRegistry';
import { createTaskListTool } from './tools/taskTools';
import { systemStatusTool } from './tools/systemTools';
import { navigateTool, createNavigateTool } from './tools/navigateTools';
import { taskOpsTools } from './tools/taskOpsTools';
import type { LLMProvider } from './types';
import type { AIRepository, TaskRepository } from '../services/repositories';

import crypto from 'crypto';

interface ToolCallDirective {
  name: string;
  params: Record<string, unknown>;
}

interface ToolDirectiveResolution {
  content: string;
  pendingToolCall?: AIPendingToolCall;
  executedToolCall?: AIToolCall;
}

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
    taskOpsTools.forEach((tool) => this.toolRegistry.register(tool));
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
    const systemPrompt = this.buildSystemPrompt(context);

    // Call LLM
    let responseContent: string;
    let executedToolCall: AIToolCall | undefined;
    let pendingToolCall: AIPendingToolCall | undefined;
    try {
      responseContent = await this.provider.chat(conversation.messages, systemPrompt);
      const toolResolution = await this.resolveToolDirective(responseContent, context);
      responseContent = toolResolution.content;
      executedToolCall = toolResolution.executedToolCall;
      pendingToolCall = toolResolution.pendingToolCall;
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
      executedToolCall,
      pendingToolCall,
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

  private buildSystemPrompt(context: AIServiceContext): string {
    const basePrompt = this.contextManager.contextToPrompt(context);
    const tools = this.toolRegistry.list();

    if (tools.length === 0) {
      return basePrompt;
    }

    return [
      basePrompt,
      '',
      '## 可用工具',
      ...tools.map((tool) => this.formatToolForPrompt(tool)),
      '',
      '## 工具调用协议',
      '当你需要调用工具时，只输出一行：',
      'YCLAW_TOOL_CALL {"name":"工具名","params":{"参数名":"参数值"}}',
      '不要在工具调用行之外输出其他内容。危险工具需要用户确认，系统不会自动执行。',
    ].join('\n');
  }

  private formatToolForPrompt(tool: AIToolDef): string {
    return [
      `- ${tool.name}: ${tool.description}`,
      `  - source: ${tool.source ?? 'builtin'}`,
      `  - confirmationLevel: ${tool.confirmationLevel}`,
      `  - parameters: ${JSON.stringify(tool.parameters)}`,
    ].join('\n');
  }

  private async resolveToolDirective(
    responseContent: string,
    context: AIServiceContext,
  ): Promise<ToolDirectiveResolution> {
    const directive = this.parseToolDirective(responseContent);
    if (!directive) {
      return { content: responseContent };
    }

    const tool = this.toolRegistry.get(directive.name);
    if (!tool) {
      return { content: `未找到工具：${directive.name}` };
    }

    if (tool.confirmationLevel >= 2) {
      return {
        content: [
          `工具 ${tool.name} 需要用户确认，尚未执行。`,
          '',
          '参数：',
          '```json',
          JSON.stringify(directive.params, null, 2),
          '```',
          '',
          '请在工具执行面板确认后再继续。',
        ].join('\n'),
        pendingToolCall: {
          name: tool.name,
          params: directive.params,
        },
      };
    }

    const result = await this.toolRegistry.execute(tool.name, directive.params, context);
    return {
      content: this.formatToolResult(tool.name, directive.params, result),
      executedToolCall: {
        name: tool.name,
        params: directive.params,
      },
    };
  }

  private parseToolDirective(responseContent: string): ToolCallDirective | null {
    const match = responseContent.match(/YCLAW_TOOL_CALL\s+(\{[\s\S]*\})/);
    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[1]) as {
        name?: unknown;
        params?: unknown;
      };
      if (typeof parsed.name !== 'string' || parsed.name.trim().length === 0) {
        return null;
      }
      if (!parsed.params || typeof parsed.params !== 'object' || Array.isArray(parsed.params)) {
        return {
          name: parsed.name.trim(),
          params: {},
        };
      }

      return {
        name: parsed.name.trim(),
        params: parsed.params as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  private formatToolResult(
    toolName: string,
    params: Record<string, unknown>,
    result: ToolResult,
  ): string {
    if (!result.success) {
      return [
        `工具调用失败：${toolName}`,
        '',
        '参数：',
        '```json',
        JSON.stringify(params, null, 2),
        '```',
        '',
        `错误：${result.error ?? '未知错误'}`,
      ].join('\n');
    }

    return [
      `已调用工具：${toolName}`,
      '',
      '参数：',
      '```json',
      JSON.stringify(params, null, 2),
      '```',
      '',
      '结果：',
      '```json',
      JSON.stringify(result.data, null, 2),
      '```',
    ].join('\n');
  }
}
