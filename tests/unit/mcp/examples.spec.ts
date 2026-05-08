import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

describe('mcp client configuration examples', () => {
  it('provides Claude Desktop and Cursor examples for stdio MCP server', () => {
    const claudePath = path.join(repoRoot, 'examples', 'mcp', 'claude-desktop.json');
    const cursorPath = path.join(repoRoot, 'examples', 'mcp', 'cursor.json');

    expect(fs.existsSync(claudePath)).toBe(true);
    expect(fs.existsSync(cursorPath)).toBe(true);

    const claude = JSON.parse(fs.readFileSync(claudePath, 'utf-8')) as {
      mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
    };
    const cursor = JSON.parse(fs.readFileSync(cursorPath, 'utf-8')) as {
      mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
    };

    for (const config of [claude, cursor]) {
      const server = config.mcpServers?.yclaw;
      expect(server).toBeDefined();
      expect(server?.command).toBe('npm');
      expect(server?.args).toEqual([
        'run',
        'yclaw',
        '--',
        'mcp',
        'serve',
        '--transport',
        'stdio',
      ]);
      expect(server?.env?.YCLAW_MCP_TOKEN).toBe('replace-with-a-local-token');
    }
  });
});
