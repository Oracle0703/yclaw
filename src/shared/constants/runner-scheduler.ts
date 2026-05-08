import type { QueueType, RunnerStatus } from '@shared/types/runner-scheduler';

export const RUNNER_STATUSES = ['online', 'degraded', 'offline', 'draining'] as const satisfies readonly RunnerStatus[];

export const DEFAULT_RUNNER_QUEUE_WEIGHTS = {
  inspect: 4,
  collect: 3,
  replay: 1,
} as const satisfies Record<QueueType, number>;

export const RUNNER_SCHEDULER_DEFAULTS = {
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  leaseTtlMs: 45_000,
  orphanGraceMs: 60_000,
  maxReassignAttempts: 2,
} as const;
