export type RunnerKind = 'local' | 'remote';
export type RunnerStatus = 'online' | 'degraded' | 'offline' | 'draining';
export type QueueType = 'inspect' | 'collect' | 'replay';
export type TaskIdempotency = 'idempotent' | 'non-idempotent' | 'unknown';
export interface RunnerRemoteDispatch {
  runnerConnectionId: string;
  revisionId: string;
  sessionId?: string | null;
  timeoutMs?: number;
  retry?: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
  };
}
export type ExecutionPlacementStatus =
  | 'queued'
  | 'dispatching'
  | 'leased'
  | 'orphaned'
  | 'reassigning'
  | 'terminal'
  | 'cancelled';
export type ExecutionLeaseStatus = 'active' | 'expired' | 'released' | 'orphaned';
export type RunnerDispatchEventType =
  | 'enqueue'
  | 'dispatch'
  | 'lease_renew'
  | 'lease_release'
  | 'orphan'
  | 'reassign'
  | 'status_change'
  | 'drain'
  | 'resume'
  | 'reject';

export interface RunnerNode {
  id: string;
  kind: RunnerKind;
  name: string;
  workspaceId: string;
  status: RunnerStatus;
  capabilities: string[];
  maxConcurrency: number;
  runningCount: number;
  cpuUsage: number;
  memoryUsage: number;
  heartbeatLatencyMs: number;
  recentFailureRate: number;
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunnerQueueItem {
  id: string;
  taskId: string;
  taskType: QueueType;
  idempotency: TaskIdempotency;
  workspaceId: string;
  status: ExecutionPlacementStatus;
  priority: number;
  reassignAttempts: number;
  lastError: string | null;
  remoteDispatch?: RunnerRemoteDispatch;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLease {
  id: string;
  executionId: string;
  queueItemId: string;
  runnerId: string;
  taskId: string;
  leaseToken: string;
  status: ExecutionLeaseStatus;
  expiresAt: string;
  lastRenewedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunnerHealthSample {
  id: string;
  runnerId: string;
  cpuUsage: number;
  memoryUsage: number;
  runningCount: number;
  maxConcurrency: number;
  heartbeatLatencyMs: number;
  recentFailureRate: number;
  sampledAt: string;
}

export interface RunnerDispatchEvent {
  id: string;
  eventType: RunnerDispatchEventType;
  runnerId: string | null;
  queueItemId: string | null;
  executionId: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RunnerScoreBreakdown {
  runnerId: string;
  score: number;
  capacityScore: number;
  resourceScore: number;
  latencyScore: number;
  failureScore: number;
  statusPenalty: number;
  filtered: boolean;
  reasons: string[];
}
