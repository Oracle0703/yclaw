import { beforeEach, describe, expect, it, vi } from 'vitest';

const serveMcpHttpMock = vi.fn();

vi.mock('@mcp/server/serveHttp', () => ({
  serveMcpHttp: serveMcpHttpMock,
}));

describe('cli · yclaw mcp http', () => {
  beforeEach(() => {
    serveMcpHttpMock.mockReset();
  });

  it('dispatches default mcp http transport to HTTP server helper', async () => {
    serveMcpHttpMock.mockResolvedValue(undefined);

    const { runCli } = await import('@cli/yclaw');

    const code = await runCli({
      argv: ['mcp', 'serve', '--transport', 'http', '--port', '4311'],
      stdout: { write: () => undefined },
      stderr: { write: () => undefined },
    });

    expect(code).toBe(0);
    expect(serveMcpHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 4311 }),
    );
  });
});
