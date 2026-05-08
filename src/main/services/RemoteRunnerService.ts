import crypto from 'crypto';
import type { RemoteExecution, RunnerConnection, RunnerHealth, RunnerInfo } from '@shared/types';
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

  saveRemoteTask(payload: { runnerConnectionId: string; taskId?: string; data: unknown }): Promise<unknown> {
    if (payload.taskId) {
      return this.requireClientMethod(payload.runnerConnectionId, 'updateTask')(payload.taskId, payload.data as never);
    }

    return this.requireClientMethod(payload.runnerConnectionId, 'createTask')(payload.data as never);
  }

  deleteRemoteTask(payload: { runnerConnectionId: string; taskId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'deleteTask')(payload.taskId);
  }

  listRemoteSessions(payload: { runnerConnectionId: string }): Promise<unknown> {
    return this.requireClientMethod(payload.runnerConnectionId, 'listSessions')();
  }

  saveRemoteSession(payload: { runnerConnectionId: string; sessionId?: string; data: unknown }): Promise<unknown> {
    if (payload.sessionId) {
      return this.requireClientMethod(payload.runnerConnectionId, 'updateSession')(
        payload.sessionId,
        payload.data as never,
      );
    }

    return this.requireClientMethod(payload.runnerConnectionId, 'createSession')(payload.data as never);
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
