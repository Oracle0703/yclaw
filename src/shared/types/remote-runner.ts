import type { TaskFlow, TaskStep } from './task';

export type RunnerConnectionStatus =
  | 'unknown'
  | 'online'
  | 'offline'
  | 'auth_failed'
  | 'incompatible';

export type RunnerTlsMode = 'strict' | 'insecure-dev';

export interface RunnerConnection {
  id: string;
  name: string;
  baseUrl: string;
  authType: 'token';
  tokenRef: string;
  workspaceId: string;
  tlsMode: RunnerTlsMode;
  proxyUrl: string | null;
  status: RunnerConnectionStatus;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RunnerCapability =
  | 'browser-automation'
  | 'screenshots'
  | 'downloads'
  | 'proxy'
  | 'headless'
  | 'headed'
  | 'sessions'
  | 'log-stream';

export interface RunnerLimits {
  maxConcurrency: number;
  maxTaskTimeoutMs: number;
  maxStepTimeoutMs: number;
  maxLogRetentionHours: number;
}

export interface RunnerInfo {
  runnerId: string;
  name: string;
  version: string;
  protocolVersion: 1;
  capabilities: RunnerCapability[];
  limits: RunnerLimits;
  serverTime: string;
}

export interface RunnerHealthMetrics {
  maxConcurrency: number;
  runningCount: number;
  cpuUsage: number;
  memoryUsage: number;
  heartbeatLatencyMs: number;
  recentFailureRate: number;
}

export interface RunnerHealth {
  status: 'ok' | 'degraded' | 'down';
  queuedCount: number;
  runningCount: number;
  lastError: string | null;
  checkedAt: string;
  metrics: RunnerHealthMetrics;
}

export interface RemoteTask {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRevision {
  revisionId: string;
  taskId: string;
  revision: number;
  flow: TaskFlow;
  createdAt: string;
  createdBy: string;
}

export type RemoteSessionStatus = 'unknown' | 'valid' | 'expired' | 'refresh_required';

export interface RemoteSession {
  id: string;
  name: string;
  origin: string;
  status: RemoteSessionStatus;
  lastValidatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRemoteSessionRequest {
  name: string;
  origin: string;
  expiresAt?: string | null;
}

export interface UpdateRemoteSessionRequest extends CreateRemoteSessionRequest {
  status?: RemoteSessionStatus;
}

export type RemoteExecutionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'timeout'
  | 'interrupted';

export type RemoteFailureReason =
  | 'runner_unavailable'
  | 'auth_failed'
  | 'session_expired'
  | 'selector_not_found'
  | 'execution_timeout'
  | 'user_canceled'
  | 'unknown';

export interface RemoteResultSummary {
  itemCount: number;
  failedStepCount: number;
  screenshotCount: number;
  outputPreview: Record<string, unknown>[];
}

export interface RemoteExecution {
  id: string;
  taskId: string;
  revisionId: string;
  runnerId: string;
  status: RemoteExecutionStatus;
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledBy: string | null;
  failureReason: RemoteFailureReason | null;
  currentStepId: string | null;
  retryCount: number;
  resultSummary: RemoteResultSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteExecutionLog {
  id: string;
  executionId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stepId: string | null;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface CreateRemoteTaskRequest {
  name: string;
  description?: string;
  tags?: string[];
  flow: TaskFlow;
}

export interface UpdateRemoteTaskRequest extends CreateRemoteTaskRequest {
  enabled: boolean;
}

export interface CreateRemoteExecutionRequest {
  taskId: string;
  revisionId: string;
  sessionId?: string | null;
  timeoutMs?: number;
  retry?: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
  };
}

export interface RemoteStepProgress {
  step: TaskStep;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  startedAt: string | null;
  finishedAt: string | null;
  retryCount: number;
}

export interface RemoteRunnerErrorEnvelope {
  error: {
    code:
      | 'auth_failed'
      | 'workspace_forbidden'
      | 'protocol_incompatible'
      | 'runner_unavailable'
      | 'task_not_found'
      | 'revision_not_found'
      | 'session_expired'
      | 'execution_not_found'
      | 'execution_not_cancelable'
      | 'execution_timeout'
      | 'rate_limited';
    message: string;
    data?: Record<string, unknown>;
  };
}
