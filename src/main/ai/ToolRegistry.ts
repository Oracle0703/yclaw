/**
 * ToolRegistry — AI 工具注册与管理
 */

import type { AIServiceContext, AIToolDef, ToolResult } from '@shared/types';
import type { AITool } from './types';

export class ToolRegistry {
  private tools = new Map<string, AITool>();

  register(tool: AITool): void {
    tool.source ??= 'builtin';
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  list(): AIToolDef[] {
    return Array.from(this.tools.values()).map(({ execute: _, ...def }) => def);
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    context: AIServiceContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found` };
    }
    return tool.execute(params, context);
  }
}
