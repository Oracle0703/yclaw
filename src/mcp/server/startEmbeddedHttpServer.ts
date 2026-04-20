import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { LogService } from '@main/services/LogService';

export interface EmbeddedMcpHttpStatus {
  running: boolean;
  host?: string;
  port?: number;
  endpoint?: string;
  transport?: 'http';
  mode?: 'streamable-http';
  authRequired?: boolean;
}

export interface EmbeddedMcpHttpHandle extends EmbeddedMcpHttpStatus {
  running: true;
  host: string;
  port: number;
  endpoint: string;
  transport: 'http';
  mode: 'streamable-http';
  authRequired: true;
  close: () => Promise<void>;
}

export interface StartEmbeddedMcpHttpServerOptions {
  createServer: () => McpServer;
  host?: string;
  port?: number;
  path?: string;
  token?: string;
  logService?: Pick<LogService, 'info' | 'error'>;
}

type HttpRequest = IncomingMessage & { body?: unknown };
type HttpResponse = ServerResponse & {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
  json: (body: unknown) => void;
};

export async function startEmbeddedMcpHttpServer(
  options: StartEmbeddedMcpHttpServerOptions,
): Promise<EmbeddedMcpHttpHandle> {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 3939;
  const routePath = options.path ?? '/mcp';
  const token = resolveToken(options.token);
  const app = createMcpExpressApp({ host });

  app.use(routePath, ((req: HttpRequest, res: HttpResponse, next: () => void) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Unauthorized: missing bearer token',
        },
      });
      return;
    }

    const [scheme, value] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value || !safeCompare(value, token)) {
      res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Unauthorized: invalid bearer token',
        },
      });
      return;
    }

    next();
  }) as unknown as Parameters<typeof app.use>[1]);

  app.post(routePath, async (req: HttpRequest, res: HttpResponse) => {
    const server = options.createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      options.logService?.error?.('main', 'Embedded MCP HTTP request failed', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  const methodNotAllowed = (
    _req: unknown,
    res: { status: (code: number) => { json: (body: unknown) => void } },
  ) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    });
  };

  app.get(routePath, methodNotAllowed);
  app.delete(routePath, methodNotAllowed);

  const httpServer = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const server = app.listen(requestedPort, host, () => resolve(server));
    server.on('error', reject);
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve embedded MCP server address');
  }

  const actualPort = (address as AddressInfo).port;
  const endpoint = `http://${host}:${actualPort}${routePath}`;

  options.logService?.info?.('main', 'Embedded MCP HTTP server started', {
    host,
    port: actualPort,
    endpoint,
  });

  return {
    running: true,
    host,
    port: actualPort,
    endpoint,
    transport: 'http',
    mode: 'streamable-http',
    authRequired: true,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          options.logService?.info?.('main', 'Embedded MCP HTTP server stopped', {
            host,
            port: actualPort,
          });
          resolve();
        });
      }),
  };
}

function resolveToken(explicitToken?: string): string {
  const token = explicitToken ?? process.env.YCLAW_MCP_TOKEN;
  if (!token || token.trim().length === 0) {
    throw new Error('YCLAW_MCP_TOKEN is required to start embedded MCP HTTP server');
  }
  return token.trim();
}

function safeCompare(input: string, expected: string): boolean {
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) {
    // Still perform a comparison against the expected length to keep timing
    // characteristics roughly constant for inputs of mismatched size.
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(inputBuf, expectedBuf);
}
