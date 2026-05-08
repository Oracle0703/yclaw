import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { REMOTE_RUNNER_PROTOCOL_VERSION } from '@shared/constants';

const MAX_REQUEST_BODY_BYTES = 1024 * 1024; // 1 MiB cap to avoid memory exhaustion DoS
import type {
  CreateRemoteExecutionRequest,
  CreateRemoteSessionRequest,
  CreateRemoteTaskRequest,
  UpdateRemoteSessionRequest,
  UpdateRemoteTaskRequest,
} from '@shared/types';
import { InMemoryRemoteRunnerRuntime, REMOTE_RUNNER_MAX_CONCURRENCY } from './InMemoryRemoteRunnerRuntime';

export interface RemoteRunnerServerOptions {
  token: string;
  workspaceId: string;
  port: number;
}

export async function createRemoteRunnerServer(options: RemoteRunnerServerOptions): Promise<{
  url: string;
  close(): Promise<void>;
}> {
  const runtime = new InMemoryRemoteRunnerRuntime();
  const runnerId = `runner-${Math.random().toString(36).slice(2)}`;
  const server = http.createServer((request, response) => {
    void routeRequest({ request, response, runtime, options, runnerId }).catch((error) => {
      const code = errorCode(error);
      const status = code === 'payload_too_large' ? 413 : 500;
      writeError(response, status, code, error instanceof Error ? error.message : String(error));
    });
  });

  await new Promise<void>((resolve) => server.listen(options.port, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

async function routeRequest(context: {
  request: IncomingMessage;
  response: ServerResponse;
  runtime: InMemoryRemoteRunnerRuntime;
  options: RemoteRunnerServerOptions;
  runnerId: string;
}): Promise<void> {
  const { request, response, runtime, options, runnerId } = context;
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const actorId = String(request.headers['x-yclaw-actor'] ?? 'unknown');

  if (!isAuthorized(request, options.token)) {
    writeError(response, 401, 'auth_failed', 'Runner token is invalid');
    return;
  }
  if (request.headers['x-yclaw-workspace'] !== options.workspaceId) {
    writeError(response, 403, 'workspace_forbidden', 'Workspace is not allowed');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/runner/info') {
    writeJson(response, 200, {
      runnerId,
      name: 'YClaw Local Remote Runner',
      version: '1.0.0',
      protocolVersion: REMOTE_RUNNER_PROTOCOL_VERSION,
      capabilities: ['browser-automation', 'sessions', 'log-stream', 'headless'],
      limits: {
        maxConcurrency: REMOTE_RUNNER_MAX_CONCURRENCY,
        maxTaskTimeoutMs: 300000,
        maxStepTimeoutMs: 30000,
        maxLogRetentionHours: 24,
      },
      serverTime: new Date().toISOString(),
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/runner/health') {
    writeJson(response, 200, {
      status: 'ok',
      queuedCount: runtime.getQueuedCount(),
      runningCount: runtime.getRunningCount(),
      lastError: null,
      checkedAt: new Date().toISOString(),
      metrics: runtime.getMetrics(),
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/tasks') {
    writeJson(response, 200, runtime.listTasks());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/tasks') {
    writeJson(response, 200, runtime.createTask(await readJson(request) as CreateRemoteTaskRequest, actorId));
    return;
  }

  const taskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
  if (taskMatch && request.method === 'PUT') {
    writeJson(
      response,
      200,
      runtime.updateTask(
        decodeURIComponent(taskMatch[1]!),
        await readJson(request) as UpdateRemoteTaskRequest,
        actorId,
      ),
    );
    return;
  }
  if (taskMatch && request.method === 'DELETE') {
    writeJson(response, 200, runtime.deleteTask(decodeURIComponent(taskMatch[1]!)));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/sessions') {
    writeJson(response, 200, runtime.listSessions());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/sessions') {
    writeJson(response, 200, runtime.createSession(await readJson(request) as CreateRemoteSessionRequest));
    return;
  }

  const sessionMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)$/);
  if (sessionMatch && request.method === 'PUT') {
    writeJson(
      response,
      200,
      runtime.updateSession(
        decodeURIComponent(sessionMatch[1]!),
        await readJson(request) as UpdateRemoteSessionRequest,
      ),
    );
    return;
  }
  if (sessionMatch && request.method === 'DELETE') {
    writeJson(response, 200, runtime.deleteSession(decodeURIComponent(sessionMatch[1]!)));
    return;
  }

  const sessionValidateMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/validate$/);
  if (sessionValidateMatch && request.method === 'POST') {
    writeJson(response, 200, runtime.validateSession(decodeURIComponent(sessionValidateMatch[1]!)));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/executions') {
    writeJson(
      response,
      200,
      runtime.startExecution(
        await readJson(request) as CreateRemoteExecutionRequest,
        actorId,
        runnerId,
      ),
    );
    return;
  }

  const executionMatch = url.pathname.match(/^\/v1\/executions\/([^/]+)$/);
  if (executionMatch && request.method === 'GET') {
    writeJson(response, 200, runtime.getExecution(decodeURIComponent(executionMatch[1]!)));
    return;
  }

  const cancelMatch = url.pathname.match(/^\/v1\/executions\/([^/]+)\/cancel$/);
  if (cancelMatch && request.method === 'POST') {
    writeJson(response, 200, runtime.cancelExecution(decodeURIComponent(cancelMatch[1]!), actorId));
    return;
  }

  const logsMatch = url.pathname.match(/^\/v1\/executions\/([^/]+)\/logs$/);
  if (logsMatch && request.method === 'GET') {
    writeJson(response, 200, runtime.getExecutionLogs(decodeURIComponent(logsMatch[1]!)));
    return;
  }

  const logStreamMatch = url.pathname.match(/^\/v1\/executions\/([^/]+)\/logs\/stream$/);
  if (logStreamMatch && request.method === 'GET') {
    const logs = runtime.getExecutionLogs(decodeURIComponent(logStreamMatch[1]!));
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    for (const log of logs) {
      response.write(`data: ${JSON.stringify(log)}\n\n`);
    }
    response.end();
    return;
  }

  writeError(response, 404, 'runner_unavailable', `Route not found: ${request.method} ${url.pathname}`);
}

function isAuthorized(request: IncomingMessage, token: string): boolean {
  const header = request.headers.authorization;
  if (typeof header !== 'string') {
    return false;
  }
  const expected = `Bearer ${token}`;
  // Length-prefixed timing-safe compare avoids leaking token length / prefix via response timing.
  const headerBuffer = Buffer.from(header, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (headerBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(headerBuffer, expectedBuffer);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw Object.assign(new Error('Request body too large'), { code: 'payload_too_large' });
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.length;
    if (received > MAX_REQUEST_BODY_BYTES) {
      throw Object.assign(new Error('Request body too large'), { code: 'payload_too_large' });
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function writeError(response: ServerResponse, statusCode: number, code: string, message: string): void {
  writeJson(response, statusCode, {
    error: {
      code,
      message,
    },
  });
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return 'runner_unavailable';
}
