import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { startEmbeddedMcpHttpServer } from '@mcp/server/startEmbeddedHttpServer';

let closeCurrent: (() => Promise<void>) | null = null;

describe('embedded mcp http server', () => {
  afterEach(async () => {
    if (closeCurrent) {
      await closeCurrent();
      closeCurrent = null;
    }
  });

  it('requires YCLAW_MCP_TOKEN or explicit token before startup', async () => {
    const previous = process.env.YCLAW_MCP_TOKEN;
    delete process.env.YCLAW_MCP_TOKEN;

    await expect(() =>
      startEmbeddedMcpHttpServer({
        createServer: () =>
          new McpServer({
            name: 'test-embedded-http-server',
            version: '1.0.0',
          }),
        host: '127.0.0.1',
        port: 0,
      }),
    ).rejects.toThrow(/YCLAW_MCP_TOKEN/i);

    if (previous === undefined) {
      delete process.env.YCLAW_MCP_TOKEN;
    } else {
      process.env.YCLAW_MCP_TOKEN = previous;
    }
  });

  it('starts on an ephemeral port and enforces bearer auth for /mcp', async () => {
    const logInfo = vi.fn();

    const handle = await startEmbeddedMcpHttpServer({
      createServer: () =>
        new McpServer({
          name: 'test-embedded-http-server',
          version: '1.0.0',
        }),
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      logService: {
        info: logInfo,
      },
    });

    closeCurrent = handle.close;

    expect(handle.running).toBe(true);
    expect(handle.endpoint).toContain('/mcp');
    expect(handle.port).toBeGreaterThan(0);
    expect(logInfo).toHaveBeenCalled();

    const unauthorized = await fetch(handle.endpoint, { method: 'GET' });
    const unauthorizedPayload = (await unauthorized.json()) as { error?: { message?: string } };

    expect(unauthorized.status).toBe(401);
    expect(unauthorizedPayload.error?.message).toMatch(/unauthorized/i);

    const invalid = await fetch(handle.endpoint, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer wrong-token',
      },
    });

    expect(invalid.status).toBe(401);

    const response = await fetch(handle.endpoint, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer secret-token',
      },
    });
    const payload = (await response.json()) as { error?: { message?: string } };

    expect(response.status).toBe(405);
    expect(payload.error?.message).toBe('Method not allowed.');
  });

  it('serves a real initialize + listTools flow over authenticated streamable HTTP', async () => {
    const server = new McpServer({
      name: 'test-embedded-http-server',
      version: '1.0.0',
    });

    server.registerTool(
      'ping',
      {
        description: 'ping tool',
        inputSchema: {},
      },
      async () => ({
        content: [{ type: 'text', text: 'pong' }],
      }),
    );

    const handle = await startEmbeddedMcpHttpServer({
      createServer: () => server,
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
    });

    closeCurrent = handle.close;

    const client = new Client({
      name: 'embedded-http-test-client',
      version: '1.0.0',
    });
    const transport = new StreamableHTTPClientTransport(new URL(handle.endpoint), {
      requestInit: {
        headers: {
          Authorization: 'Bearer secret-token',
        },
      },
    });

    await client.connect(transport);
    const tools = await client.listTools();

    expect(tools.tools.map((item) => item.name)).toContain('ping');

    await transport.close();
  });
});
