import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolRegistry } from '@main/ai/ToolRegistry';
import { McpClientManager } from '@mcp/client/McpClientManager';
import type { AIServiceContext } from '@shared/types';

const mockContext: AIServiceContext = {
  currentModule: 'workbench',
  systemMetrics: { cpu: 20, memory: 30, disk: 40, uptime: 3600 },
  recentTasks: [],
  installedPlugins: [],
};

describe('mcp client integration', () => {
  let manager: McpClientManager | null = null;
  const fixturePath = fileURLToPath(
    new URL('../../fixtures/mcp/mock-stdio-server.mjs', import.meta.url),
  );

  afterEach(async () => {
    if (manager) {
      await manager.close();
      manager = null;
    }
  });

  it('registers external MCP tools into ToolRegistry and proxies execution', async () => {
    const registry = new ToolRegistry();
    manager = new McpClientManager({ toolRegistry: registry });

    await manager.syncServers([
      {
        id: 'mock',
        name: 'Mock Server',
        command: process.execPath,
        args: [path.resolve(fixturePath)],
        enabled: true,
      },
    ]);

    const tools = registry.list();

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'mcp.mock.echo',
          source: 'mcp:mock',
          confirmationLevel: 0,
        }),
        expect.objectContaining({
          name: 'mcp.mock.danger',
          source: 'mcp:mock',
          confirmationLevel: 2,
        }),
      ]),
    );

    const result = await registry.execute('mcp.mock.echo', { text: 'hello mcp' }, mockContext);

    expect(result).toMatchObject({
      success: true,
      data: {
        content: [
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('hello mcp'),
          }),
        ],
      },
    });
  });

  it('removes MCP tools when server config is cleared', async () => {
    const registry = new ToolRegistry();
    manager = new McpClientManager({ toolRegistry: registry });

    await manager.syncServers([
      {
        id: 'mock',
        name: 'Mock Server',
        command: process.execPath,
        args: [path.resolve(fixturePath)],
        enabled: true,
      },
    ]);
    expect(registry.list().map((tool) => tool.name)).toContain('mcp.mock.echo');

    await manager.syncServers([]);

    expect(registry.list().map((tool) => tool.name)).not.toContain('mcp.mock.echo');
  });

  it('marks an unreachable MCP server as unavailable without crashing sync', async () => {
    const registry = new ToolRegistry();
    manager = new McpClientManager({ toolRegistry: registry });

    await manager.syncServers([
      {
        id: 'broken',
        name: 'Broken Server',
        command: process.execPath,
        args: ['-e', 'process.exit(1)'],
        enabled: true,
      },
    ]);

    expect(registry.list()).toEqual([]);
    expect(manager.getServerStatuses()).toEqual([
      expect.objectContaining({
        id: 'broken',
        name: 'Broken Server',
        enabled: true,
        connected: false,
        state: 'unavailable',
        toolCount: 0,
        lastError: expect.any(String),
      }),
    ]);
  });
});
