import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'yclaw-mock-mcp-server',
  version: '1.0.0',
});

server.registerTool(
  'echo',
  {
    description: '回显输入内容',
    inputSchema: {
      text: z.string(),
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  async ({ text }) => ({
    content: [{ type: 'text', text: `echo:${String(text ?? '')}` }],
  }),
);

server.registerTool(
  'danger',
  {
    description: '危险操作示例',
    inputSchema: {
      action: z.string().optional(),
    },
    annotations: {
      destructiveHint: true,
    },
  },
  async ({ action }) => ({
    content: [{ type: 'text', text: `danger:${String(action ?? 'noop')}` }],
    _meta: { dangerous: true },
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
