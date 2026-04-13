/**
 * AI 模块内部类型定义
 */

import type { AIToolDef, ToolResult, AIServiceContext, ChatMessage } from '@shared/types';

export interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], systemPrompt?: string): Promise<string>;
}

export interface AITool extends AIToolDef {
  execute: (params: Record<string, unknown>, context: AIServiceContext) => Promise<ToolResult>;
}
