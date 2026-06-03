import crypto from 'crypto';
import type {
  CreateRemoteSessionRequest,
  CreateRemoteTaskRequest,
  RemoteExecution,
  RunnerConnection,
  RunnerHealth,
  RunnerInfo,
  TaskFlow,
  UpdateRemoteSessionRequest,
  UpdateRemoteTaskRequest,
} from '@shared/types';
import { REMOTE_RUNNER_PROTOCOL_VERSION, sanitizeRunnerConnection } from '@shared/constants';
import { RemoteRunnerClient } from '@main/remote-runner';

export interface SaveRunnerConnectionInput {
  id?: string;
  name: string;
  baseUrl: string;
  token: string;
  workspaceId: string;
  tlsMode: RunnerConnection['tlsMode'];
  proxyUrl: string | null;
}

export interface RemoteRunnerRepositoryLike {
  list(): RunnerConnection[];
  get(id: string): RunnerConnection | null;
  save(connection: RunnerConnection): RunnerConnection;
  delete(id: string): void;
}

export interface RemoteRunnerServiceOptions {
  repository: RemoteRunnerRepositoryLike;
  actorId: string;
  createClient?: (connection: RunnerConnection) => Pick<RemoteRunnerClient, 'getInfo' | 'getHealth'> & Partial<RemoteRunnerClient>;
}

export class RemoteRunnerService {
  private readonly repository: RemoteRunnerRepositoryLike;
  private readonly actorId: string;
  private readonly createClient: (
    connection: RunnerConnection,
  ) => Pick<RemoteRunnerClient, 'getInfo' | 'getHealth'> & Partial<RemoteRunnerClient>;

  constructor(options: RemoteRunnerServiceOptions) {
    this.repository = options.repository;
    this.actorId = options.actorId;
    this.createClient =
      options.createClient
      ?? ((connection) =>
        new RemoteRunnerClient({
          baseUrl: connection.baseUrl,
          token: connection.tokenRef,
          workspaceId: connection.workspaceId,
          actorId: this.actorId,
        }));
  }

  listConnections(): RunnerConnection[] {
    return this.repository.list().map(sanitizeRunnerConnection);
  }

  async saveConnection(input: SaveRunnerConnectionInput): Promise<RunnerConnection> {
    const now = new Date().toISOString();
    const existing = input.id ? this.repository.get(input.id) : null;
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const connection: RunnerConnection = {
      id: existing?.id ?? input.id ?? crypto.randomUUID(),
      name: input.name.trim() || 'Remote Runner',
      baseUrl,
      authType: 'token',
      tokenRef: input.token,
      workspaceId: input.workspaceId.trim() || 'default',
      tlsMode: input.tlsMode,
      proxyUrl: input.proxyUrl,
      status: existing?.status ?? 'unknown',
      lastSeenAt: existing?.lastSeenAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    return sanitizeRunnerConnection(this.repository.save(connection));
  }

  deleteConnection(id: string): void {
    this.repository.delete(id);
  }

  listRemoteTasks(payload: { runnerConnectionId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'listTasks')();
  }

  async saveRemoteTask(payload: { runnerConnectionId: string; taskId?: string; data: unknown }): Promise<unknown> {
    if (payload.taskId) {
      return this.requireClientMethod(payload.runnerConnectionId, 'updateTask')(
        payload.taskId,
        assertUpdateRemoteTaskRequest(payload.data),
      );
    }

    return this.requireClientMethod(payload.runnerConnectionId, 'createTask')(
      assertCreateRemoteTaskRequest(payload.data),
    );
  }

  deleteRemoteTask(payload: { runnerConnectionId: string; taskId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'deleteTask')(payload.taskId);
  }

  listRemoteSessions(payload: { runnerConnectionId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'listSessions')();
  }

  async saveRemoteSession(payload: { runnerConnectionId: string; sessionId?: string; data: unknown }): Promise<unknown> {
    if (payload.sessionId) {
      return this.requireClientMethod(payload.runnerConnectionId, 'updateSession')(
        payload.sessionId,
        assertUpdateRemoteSessionRequest(payload.data),
      );
    }

    return this.requireClientMethod(payload.runnerConnectionId, 'createSession')(
      assertCreateRemoteSessionRequest(payload.data),
    );
  }

  deleteRemoteSession(payload: { runnerConnectionId: string; sessionId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'deleteSession')(payload.sessionId);
  }

  startExecution(payload: {
    runnerConnectionId: string;
    taskId: string;
    revisionId: string;
    sessionId?: string | null;
    timeoutMs?: number;
    retry?: {
      maxAttempts: number;
      backoff: 'fixed' | 'exponential';
    };
  }): Promise<RemoteExecution> {
    return this.requireClientMethod(payload.runnerConnectionId, 'startExecution')({
      taskId: payload.taskId,
      revisionId: payload.revisionId,
      sessionId: payload.sessionId,
      timeoutMs: payload.timeoutMs,
      retry: payload.retry,
    });
  }

  getExecution(payload: { runnerConnectionId: string; executionId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'getExecution')(payload.executionId);
  }

  cancelExecution(payload: { runnerConnectionId: string; executionId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'cancelExecution')(payload.executionId);
  }

  getExecutionLogs(payload: { runnerConnectionId: string; executionId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'getExecutionLogs')(payload.executionId);
  }

  async testConnection(id: string): Promise<{
    connection: RunnerConnection;
    info: RunnerInfo;
    health: RunnerHealth;
  }> {
    const connection = this.requireConnection(id);
    const client = this.createClient(connection);
    const info = await client.getInfo();

    if (info.protocolVersion !== REMOTE_RUNNER_PROTOCOL_VERSION) {
      const updated = this.repository.save({
        ...connection,
        status: 'incompatible',
        updatedAt: new Date().toISOString(),
      });

      return {
        connection: sanitizeRunnerConnection(updated),
        info,
        health: {
          status: 'degraded',
          queuedCount: 0,
          runningCount: 0,
          lastError: 'protocol_incompatible',
          checkedAt: new Date().toISOString(),
          metrics: {
            maxConcurrency: info.limits.maxConcurrency,
            runningCount: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            heartbeatLatencyMs: 0,
            recentFailureRate: 0,
          },
        },
      };
    }

    const health = await client.getHealth();
    const updated = this.repository.save({
      ...connection,
      status: 'online',
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      connection: sanitizeRunnerConnection(updated),
      info,
      health,
    };
  }

  private requireConnection(id: string): RunnerConnection {
    const connection = this.repository.get(id);
    if (!connection) {
      throw new Error(`Runner connection "${id}" not found`);
    }

    return connection;
  }

  private clientFor(connectionId: string): Pick<RemoteRunnerClient, 'getInfo' | 'getHealth'> & Partial<RemoteRunnerClient> {
    return this.createClient(this.requireConnection(connectionId));
  }

  private requireClientMethod<T extends keyof RemoteRunnerClient>(
    connectionId: string,
    method: T,
  ): NonNullable<RemoteRunnerClient[T]> {
    const client = this.clientFor(connectionId);
    const candidate = client[method];
    if (!candidate) {
      throw new Error(`Remote runner client method "${String(method)}" is not available`);
    }

    return candidate as NonNullable<RemoteRunnerClient[T]>;
  }
}

function normalizeBaseUrl(input: string): string {
  const trimmed = (input ?? '').trim();
  if (!trimmed) {
    throw new Error('Runner baseUrl is required');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Runner baseUrl must be an absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Runner baseUrl must use http or https');
  }
  return trimmed.replace(/\/+$/, '');
}

function assertCreateRemoteTaskRequest(value: unknown): CreateRemoteTaskRequest {
  const body = assertRecord(value);
  if (body.flow === undefined) {
    throw new Error('flow is required');
  }
  return {
    name: assertNonEmptyString(body.name, 'name'),
    description: typeof body.description === 'string' ? body.description : undefined,
    tags: body.tags === undefined ? undefined : assertStringArray(body.tags, 'tags'),
    flow: assertTaskFlow(body.flow),
  };
}

function assertUpdateRemoteTaskRequest(value: unknown): UpdateRemoteTaskRequest {
  const body = assertRecord(value);
  return {
    ...assertCreateRemoteTaskRequest(body),
    enabled: body.enabled === true,
  };
}

function assertCreateRemoteSessionRequest(value: unknown): CreateRemoteSessionRequest {
  const body = assertRecord(value);
  return {
    name: assertNonEmptyString(body.name, 'name'),
    origin: assertNonEmptyString(body.origin, 'origin'),
    expiresAt:
      typeof body.expiresAt === 'string' || body.expiresAt === null ? body.expiresAt : undefined,
  };
}

function assertUpdateRemoteSessionRequest(value: unknown): UpdateRemoteSessionRequest {
  const body = assertRecord(value);
  const status = body.status === undefined ? undefined : assertRemoteSessionStatus(body.status);
  return {
    ...assertCreateRemoteSessionRequest(body),
    ...(status ? { status } : {}),
  };
}

function assertTaskFlow(value: unknown): TaskFlow {
  const flow = assertRecord(value);
  assertNonEmptyString(flow.name, 'flow.name');
  if (!Array.isArray(flow.steps)) {
    throw new Error('flow.steps is required');
  }
  return flow as unknown as TaskFlow;
}

function assertRemoteSessionStatus(value: unknown): UpdateRemoteSessionRequest['status'] {
  if (
    value === 'unknown'
    || value === 'valid'
    || value === 'expired'
    || value === 'refresh_required'
  ) {
    return value;
  }
  throw new Error('status is invalid');
}

function assertRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('payload object is required');
  }
  return value as Record<string, unknown>;
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} is invalid`);
  }
  return value;
}
