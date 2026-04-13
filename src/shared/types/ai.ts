/**
 * AI 模块共享类型定义
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AIConfig {
  provider: 'openai' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  confirmationLevel: 0 | 1 | 2 | 3;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AIServiceContext {
  currentModule: string;
  systemMetrics: {
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
  };
  recentTasks: Array<{
    name: string;
    status: string;
    updatedAt: string;
  }>;
  installedPlugins: Array<{
    name: string;
    version: string;
    enabled: boolean;
  }>;
}

export interface AIChatRequest {
  message: string;
  conversationId?: string;
}

export interface AIChatResponse {
  message: ChatMessage;
  conversationId: string;
}
