import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { registerDangerousCapabilities } from './registerDangerousCapabilities';
import { registerReadOnlyCapabilities } from './registerReadOnlyCapabilities';
import type { CreateMcpServerOptions } from '../shared/types';

export function createMcpServer(options: CreateMcpServerOptions): McpServer {
  const server = new McpServer(
    options.serverInfo ?? {
      name: 'yclaw-mcp-server',
      version: '1.0.0',
    },
  );

  registerReadOnlyCapabilities(server, options);
  registerDangerousCapabilities(server, options);

  return server;
}
