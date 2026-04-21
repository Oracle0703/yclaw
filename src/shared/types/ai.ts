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
  mcp?: {
    embeddedHttp?: {
      host?: string;
      port?: number;
      token?: string;
    };
    servers?: McpClientServerConfig[];
  };
}

export interface McpClientServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface McpClientServerStatus {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  state: 'connected' | 'unavailable' | 'disabled';
  toolCount: number;
  lastError?: string;
}

export interface AIToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  confirmationLevel: 0 | 1 | 2 | 3;
  source?: 'builtin' | `mcp:${string}`;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AITaskOpsTaskSummary {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  currentRevisionId?: string | null;
}

export interface AITaskOpsRunnerSummary {
  id: string;
  name: string;
  kind: string;
  status: string;
  runningCount: number;
  maxConcurrency: number;
}

export interface AITaskOpsResultSummary {
  taskId: string;
  batchId: string;
  status: string;
  qualityStatus?: string;
  revisionId?: string;
}

export interface AITaskOperationsContext {
  workspaces: Array<{
    id: string;
    name: string;
  }>;
  tasks: AITaskOpsTaskSummary[];
  alerts: Array<{
    id: string;
    taskId: string;
    batchId?: string;
    message: string;
    createdAt: string;
    read: boolean;
    status?: string;
    level?: string;
    assignee?: string | null;
  }>;
  reviews: Array<{
    id: string;
    taskId: string;
    batchId?: string | null;
    reviewType: string;
    conclusion?: string | null;
    owner?: string | null;
    followUpActions: string[];
    createdAt: string;
  }>;
  runners: AITaskOpsRunnerSummary[];
  results: AITaskOpsResultSummary[];
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
  taskOperations?: AITaskOperationsContext;
}

export interface AIChatRequest {
  message: string;
  conversationId?: string;
}

export interface AIToolCall {
  name: string;
  params: Record<string, unknown>;
}

export type AIPendingToolCall = AIToolCall;

export interface AIChatResponse {
  message: ChatMessage;
  conversationId: string;
  pendingToolCall?: AIPendingToolCall;
  executedToolCall?: AIToolCall;
}
