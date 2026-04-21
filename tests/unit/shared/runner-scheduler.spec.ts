import { describe, expect, it } from 'vitest';
import {
  IPC_CHANNELS,
  DEFAULT_RUNNER_QUEUE_WEIGHTS,
  RUNNER_SCHEDULER_DEFAULTS,
  RUNNER_STATUSES,
} from '@shared/constants';
import type { RunnerStatus, QueueType, TaskFlow, TaskIdempotency } from '@shared/types';

describe('runner scheduler shared contract', () => {
  it('defines runner states used by registry', () => {
    const statuses = RUNNER_STATUSES satisfies readonly RunnerStatus[];
    expect(statuses).toEqual(['online', 'degraded', 'offline', 'draining']);
  });

  it('uses inspect collect replay weighted queues', () => {
    const queueTypes: QueueType[] = ['inspect', 'collect', 'replay'];
    const idempotency: TaskIdempotency[] = ['idempotent', 'non-idempotent', 'unknown'];
    expect(queueTypes).toHaveLength(3);
    expect(idempotency).toContain('unknown');
    expect(DEFAULT_RUNNER_QUEUE_WEIGHTS).toEqual({ inspect: 4, collect: 3, replay: 1 });
  });

  it('sets safe default lease and heartbeat thresholds', () => {
    expect(RUNNER_SCHEDULER_DEFAULTS).toMatchObject({
      heartbeatIntervalMs: 10_000,
      heartbeatTimeoutMs: 30_000,
      leaseTtlMs: 45_000,
      orphanGraceMs: 60_000,
      maxReassignAttempts: 2,
    });
  });

  it('adds scheduler IPC channels using lowercase module naming', () => {
    expect(IPC_CHANNELS.RUNNER_REGISTRY_LIST).toBe('runner:registry:list');
    expect(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE).toBe('runner:queue:enqueue');
    expect(IPC_CHANNELS.RUNNER_LEASE_RECONCILE).toBe('runner:lease:reconcile');
  });

  it('accepts task flow scheduling metadata contract', () => {
    const flow: TaskFlow = {
      id: 'flow-1',
      name: 'Scheduler Metadata Flow',
      steps: [],
      scheduling: {
        taskType: 'collect',
        idempotency: 'idempotent',
        preferredRunnerKind: 'remote',
        requiredCapabilities: ['browser-automation', 'headless'],
      },
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    };

    expect(flow.scheduling).toEqual({
      taskType: 'collect',
      idempotency: 'idempotent',
      preferredRunnerKind: 'remote',
      requiredCapabilities: ['browser-automation', 'headless'],
    });
  });
});
