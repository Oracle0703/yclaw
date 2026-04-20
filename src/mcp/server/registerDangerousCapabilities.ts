import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { sessionRefreshInputSchema, taskRunInputSchema } from '../shared/schemas';
import type { CreateMcpServerOptions } from '../shared/types';

function createJsonToolResult(payload: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function createDangerousMeta() {
  return {
    dangerous: true,
    'yclaw/dangerous': true,
  };
}

function writeAudit(
  options: CreateMcpServerOptions,
  toolName: string,
  args: Record<string, unknown>,
): void {
  options.auditLogger?.({
    toolName,
    arguments: args,
    timestamp: new Date().toISOString(),
  });
}

// See note in registerReadOnlyCapabilities: cast to break TS2589 under CJS.
interface RelaxedRegisterServer {
  registerTool: (
    name: string,
    options: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<unknown>,
  ) => unknown;
}

export function registerDangerousCapabilities(
  serverInput: McpServer,
  options: CreateMcpServerOptions,
): void {
  const server = serverInput as unknown as RelaxedRegisterServer;
  if (options.dangerousActions?.runTask) {
    server.registerTool(
      'task.run',
      {
        title: '触发任务执行',
        description: '触发指定任务执行并返回批次信息。',
        inputSchema: taskRunInputSchema,
        annotations: {
          destructiveHint: true,
          idempotentHint: false,
          readOnlyHint: false,
        },
        _meta: createDangerousMeta(),
      },
      async ({ taskId }) => {
        writeAudit(options, 'task.run', { taskId });
        const result = await options.dangerousActions!.runTask!(taskId);
        return createJsonToolResult(result);
      },
    );
  }

  if (options.dangerousActions?.refreshSession) {
    server.registerTool(
      'session.refresh',
      {
        title: '刷新会话登录态',
        description: '重新建立指定会话的登录态。',
        inputSchema: sessionRefreshInputSchema,
        annotations: {
          destructiveHint: true,
          idempotentHint: false,
          readOnlyHint: false,
        },
        _meta: createDangerousMeta(),
      },
      async ({ sessionId }) => {
        writeAudit(options, 'session.refresh', { sessionId });
        const result = await options.dangerousActions!.refreshSession!(sessionId);
        return createJsonToolResult(result);
      },
    );
  }
}
