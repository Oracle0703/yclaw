import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import type { Tool } from '@modelcontextprotocol/sdk/types';
import type { ToolRegistry } from '@main/ai/ToolRegistry';
import type { AITool } from '@main/ai/types';
import type { McpClientServerConfig, McpClientServerStatus } from '@shared/types';

interface McpClientManagerOptions {
  toolRegistry: ToolRegistry;
  logService?: {
    info?: (source: 'main', message: string, data?: unknown) => void;
    warn?: (source: 'main', message: string, data?: unknown) => void;
    error?: (source: 'main', message: string, data?: unknown) => void;
  };
}

interface ManagedServerConnection {
  client: Client;
  transport: StdioClientTransport;
  registeredToolNames: string[];
}

export class McpClientManager {
  private readonly toolRegistry: ToolRegistry;
  private readonly logService?: McpClientManagerOptions['logService'];
  private readonly connections = new Map<string, ManagedServerConnection>();
  private readonly statuses = new Map<string, McpClientServerStatus>();

  constructor(options: McpClientManagerOptions) {
    this.toolRegistry = options.toolRegistry;
    this.logService = options.logService;
  }

  async syncServers(servers: McpClientServerConfig[] = []): Promise<void> {
    await this.close();
    this.statuses.clear();

    for (const server of servers) {
      if (server.enabled === false) {
        this.statuses.set(server.id, {
          id: server.id,
          name: server.name,
          enabled: false,
          connected: false,
          state: 'disabled',
          toolCount: 0,
        });
        continue;
      }

      await this.connectServer(server);
    }
  }

  getServerStatuses(): McpClientServerStatus[] {
    return Array.from(this.statuses.values());
  }

  async close(): Promise<void> {
    for (const [serverId, connection] of this.connections.entries()) {
      for (const toolName of connection.registeredToolNames) {
        this.toolRegistry.unregister(toolName);
      }

      await this.safeCloseConnection(serverId, connection);
    }

    this.connections.clear();
  }

  private async connectServer(server: McpClientServerConfig): Promise<void> {
    const client = new Client({
      name: `yclaw-mcp-client-${server.id}`,
      version: '1.0.0',
    });
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env: this.buildEnv(server.env),
    });

    try {
      await client.connect(transport);
      const toolList = await client.listTools();
      const registeredToolNames = toolList.tools.map((tool) => {
        const wrappedTool = this.createWrappedTool(server, client, tool);
        this.toolRegistry.register(wrappedTool);
        return wrappedTool.name;
      });

      this.connections.set(server.id, {
        client,
        transport,
        registeredToolNames,
      });
      this.statuses.set(server.id, {
        id: server.id,
        name: server.name,
        enabled: true,
        connected: true,
        state: 'connected',
        toolCount: registeredToolNames.length,
      });
      this.logService?.info?.(
        'main',
        `External MCP server connected: ${server.id}`,
        registeredToolNames,
      );
    } catch (error) {
      await this.safeDisposeTransport(transport);
      const message = error instanceof Error ? error.message : String(error);
      this.statuses.set(server.id, {
        id: server.id,
        name: server.name,
        enabled: true,
        connected: false,
        state: 'unavailable',
        toolCount: 0,
        lastError: message,
      });
      this.logService?.warn?.(
        'main',
        `External MCP server unavailable: ${server.id}`,
        message,
      );
    }
  }

  private createWrappedTool(server: McpClientServerConfig, client: Client, tool: Tool): AITool {
    const fullName = `mcp.${server.id}.${tool.name}`;
    const confirmationLevel = this.getConfirmationLevel(tool);

    return {
      name: fullName,
      description: tool.description ?? `${server.name} / ${tool.name}`,
      parameters: this.normalizeParameters(tool.inputSchema),
      confirmationLevel,
      source: `mcp:${server.id}`,
      execute: async (params) => {
        this.logService?.info?.('main', 'MCP tool execute requested', {
          serverId: server.id,
          tool: fullName,
          params,
        });

        try {
          const result = await client.callTool({
            name: tool.name,
            arguments: params,
          });

          if (result.isError) {
            this.logService?.warn?.('main', 'MCP tool execute failed', {
              serverId: server.id,
              tool: fullName,
              params,
              error: this.extractToolError(result),
            });
            return {
              success: false,
              error: this.extractToolError(result),
            };
          }

          this.logService?.info?.('main', 'MCP tool execute completed', {
            serverId: server.id,
            tool: fullName,
            params,
          });

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          this.logService?.warn?.('main', 'MCP tool execute failed', {
            serverId: server.id,
            tool: fullName,
            params,
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    };
  }

  private getConfirmationLevel(tool: Tool): 0 | 1 | 2 | 3 {
    if (tool.annotations?.destructiveHint || tool._meta?.dangerous === true) {
      return 2;
    }

    if (tool.annotations?.readOnlyHint) {
      return 0;
    }

    return 1;
  }

  private normalizeParameters(inputSchema: unknown): Record<string, unknown> {
    if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) {
      return {};
    }

    return inputSchema as Record<string, unknown>;
  }

  private buildEnv(overrides?: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries({
        ...process.env,
        ...overrides,
      }).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  }

  private extractToolError(result: unknown): string {
    if (!result || typeof result !== 'object') {
      return 'MCP tool call failed';
    }

    const maybeContent = (result as { content?: unknown }).content;
    if (!Array.isArray(maybeContent)) {
      return 'MCP tool call failed';
    }

    const textBlock = maybeContent.find((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const block = item as { type?: unknown; text?: unknown };
      return block.type === 'text' && typeof block.text === 'string';
    }) as { text?: string } | undefined;

    return textBlock?.text ?? 'MCP tool call failed';
  }

  private async safeCloseConnection(
    serverId: string,
    connection: ManagedServerConnection,
  ): Promise<void> {
    await this.safeCloseClient(connection.client);
    await this.safeDisposeTransport(connection.transport);
    this.logService?.info?.('main', `External MCP server disconnected: ${serverId}`);
  }

  private async safeCloseClient(client: Client): Promise<void> {
    const closableClient = client as Client & { close?: () => Promise<void> };
    if (typeof closableClient.close === 'function') {
      try {
        await closableClient.close();
      } catch {
        // ignore client close failures; transport close is the real cleanup boundary
      }
    }
  }

  private async safeDisposeTransport(transport: StdioClientTransport): Promise<void> {
    try {
      await transport.close();
    } catch {
      // ignore transport disposal failures during reconnect/shutdown
    }
  }
}
