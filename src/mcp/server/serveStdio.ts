import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { createCliMcpRuntime } from './createCliMcpServer';

export async function serveMcpStdio(): Promise<void> {
  const runtime = createCliMcpRuntime();
  const server = runtime.createServer();
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    await server.close();
    runtime.close();
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  await server.connect(transport);
}
