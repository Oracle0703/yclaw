import type {
  CreateRemoteExecutionRequest,
  CreateRemoteSessionRequest,
  CreateRemoteTaskRequest,
  RemoteExecution,
  RemoteExecutionLog,
  RemoteRunnerErrorEnvelope,
  RemoteSession,
  RemoteTask,
  RunnerHealth,
  RunnerInfo,
  TaskRevision,
  UpdateRemoteSessionRequest,
  UpdateRemoteTaskRequest,
} from '@shared/types/remote-runner';
import { REMOTE_RUNNER_API } from '@shared/constants/remote-runner';

type FetchLike = typeof fetch;

export class RemoteRunnerApiError extends Error {
  constructor(
    public readonly code: RemoteRunnerErrorEnvelope['error']['code'],
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RemoteRunnerApiError';
  }
}

export interface RemoteRunnerClientOptions {
  baseUrl: string;
  token: string;
  workspaceId: string;
  actorId: string;
  fetchImpl?: FetchLike;
}

export class RemoteRunnerClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly workspaceId: string;
  private readonly actorId: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: RemoteRunnerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.workspaceId = options.workspaceId;
    this.actorId = options.actorId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getInfo(): Promise<RunnerInfo> {
    return this.request<RunnerInfo>(REMOTE_RUNNER_API.INFO);
  }

  getHealth(): Promise<RunnerHealth> {
    return this.request<RunnerHealth>(REMOTE_RUNNER_API.HEALTH);
  }

  listTasks(): Promise<RemoteTask[]> {
    return this.request<RemoteTask[]>(REMOTE_RUNNER_API.TASKS);
  }

  createTask(payload: CreateRemoteTaskRequest): Promise<{ task: RemoteTask; revision: TaskRevision }> {
    return this.request<{ task: RemoteTask; revision: TaskRevision }>(REMOTE_RUNNER_API.TASKS, {
      method: 'POST',
      body: payload,
    });
  }

  updateTask(
    taskId: string,
    payload: UpdateRemoteTaskRequest,
  ): Promise<{ task: RemoteTask; revision: TaskRevision }> {
    return this.request<{ task: RemoteTask; revision: TaskRevision }>(
      `${REMOTE_RUNNER_API.TASKS}/${encodeURIComponent(taskId)}`,
      {
        method: 'PUT',
        body: payload,
      },
    );
  }

  deleteTask(taskId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(`${REMOTE_RUNNER_API.TASKS}/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    });
  }

  listSessions(): Promise<RemoteSession[]> {
    return this.request<RemoteSession[]>(REMOTE_RUNNER_API.SESSIONS);
  }

  createSession(payload: CreateRemoteSessionRequest): Promise<RemoteSession> {
    return this.request<RemoteSession>(REMOTE_RUNNER_API.SESSIONS, {
      method: 'POST',
      body: payload,
    });
  }

  updateSession(sessionId: string, payload: UpdateRemoteSessionRequest): Promise<RemoteSession> {
    return this.request<RemoteSession>(
      `${REMOTE_RUNNER_API.SESSIONS}/${encodeURIComponent(sessionId)}`,
      {
        method: 'PUT',
        body: payload,
      },
    );
  }

  deleteSession(sessionId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(
      `${REMOTE_RUNNER_API.SESSIONS}/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
    );
  }

  validateSession(sessionId: string): Promise<RemoteSession> {
    return this.request<RemoteSession>(
      `${REMOTE_RUNNER_API.SESSIONS}/${encodeURIComponent(sessionId)}/validate`,
      { method: 'POST' },
    );
  }

  startExecution(payload: CreateRemoteExecutionRequest): Promise<RemoteExecution> {
    return this.request<RemoteExecution>(REMOTE_RUNNER_API.EXECUTIONS, {
      method: 'POST',
      body: payload,
    });
  }

  getExecution(executionId: string): Promise<RemoteExecution> {
    return this.request<RemoteExecution>(
      `${REMOTE_RUNNER_API.EXECUTIONS}/${encodeURIComponent(executionId)}`,
    );
  }

  cancelExecution(executionId: string): Promise<RemoteExecution> {
    return this.request<RemoteExecution>(
      `${REMOTE_RUNNER_API.EXECUTIONS}/${encodeURIComponent(executionId)}/cancel`,
      {
        method: 'POST',
      },
    );
  }

  getExecutionLogs(executionId: string): Promise<RemoteExecutionLog[]> {
    return this.request<RemoteExecutionLog[]>(
      `${REMOTE_RUNNER_API.EXECUTIONS}/${encodeURIComponent(executionId)}/logs`,
    );
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-YClaw-Workspace': this.workspaceId,
        'X-YClaw-Actor': this.actorId,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const envelope = payload as Partial<RemoteRunnerErrorEnvelope>;
      const error = envelope.error;
      throw new RemoteRunnerApiError(
        error?.code ?? 'runner_unavailable',
        error?.message ?? `Runner request failed with status ${response.status}`,
        error?.data,
      );
    }

    return payload as T;
  }
}
