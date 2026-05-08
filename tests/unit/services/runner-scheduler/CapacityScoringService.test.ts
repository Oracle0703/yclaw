import { describe, expect, it } from 'vitest';
import { CapacityScoringService } from '@main/services/runner-scheduler/CapacityScoringService';
import type { RunnerNode } from '@shared/types';

function runner(overrides: Partial<RunnerNode>): RunnerNode {
  return {
    id: 'runner-a',
    kind: 'local',
    name: 'Runner A',
    workspaceId: 'default',
    status: 'online',
    capabilities: ['browser-automation'],
    maxConcurrency: 4,
    runningCount: 0,
    cpuUsage: 0.1,
    memoryUsage: 0.1,
    heartbeatLatencyMs: 10,
    recentFailureRate: 0,
    lastHeartbeatAt: '2026-04-21T00:00:00.000Z',
    lastSeenAt: '2026-04-21T00:00:00.000Z',
    createdAt: '2026-04-21T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('CapacityScoringService', () => {
  it('scores lower load runners lower', () => {
    const service = new CapacityScoringService();
    const low = service.score(runner({ id: 'low', runningCount: 1, maxConcurrency: 4 }));
    const high = service.score(runner({ id: 'high', runningCount: 3, maxConcurrency: 4 }));
    expect(low.score).toBeLessThan(high.score);
  });

  it('filters full and offline runners before dispatch', () => {
    const service = new CapacityScoringService();
    expect(service.score(runner({ runningCount: 4, maxConcurrency: 4 })).filtered).toBe(true);
    expect(service.score(runner({ status: 'offline' })).filtered).toBe(true);
  });

  it('adds degraded penalty but keeps runner schedulable', () => {
    const service = new CapacityScoringService();
    const online = service.score(runner({ id: 'online', status: 'online' }));
    const degraded = service.score(runner({ id: 'degraded', status: 'degraded' }));
    expect(degraded.filtered).toBe(false);
    expect(degraded.score).toBeGreaterThan(online.score);
  });

  it('selectBest chooses the lowest score among schedulable runners', () => {
    const service = new CapacityScoringService();
    const best = runner({ id: 'best', runningCount: 0, cpuUsage: 0.1, memoryUsage: 0.1 });
    const medium = runner({ id: 'medium', runningCount: 2, cpuUsage: 0.4, memoryUsage: 0.4 });
    const filtered = runner({ id: 'filtered', runningCount: 4, maxConcurrency: 4 });

    const result = service.selectBest([medium, filtered, best]);

    expect(result.runner?.id).toBe('best');
    expect(result.breakdowns).toHaveLength(3);
    expect(result.breakdowns.find((entry) => entry.runnerId === 'filtered')?.filtered).toBe(true);
  });

  it('filters draining runners with status reason', () => {
    const service = new CapacityScoringService();
    const scored = service.score(runner({ status: 'draining' }));

    expect(scored.filtered).toBe(true);
    expect(scored.reasons).toContain('status:draining');
    expect(scored.score).toBe(999);
  });

  it('clamps out-of-range metrics before calculating scores', () => {
    const service = new CapacityScoringService();
    const scored = service.score(
      runner({
        maxConcurrency: -2,
        runningCount: 0,
        cpuUsage: 1.5,
        memoryUsage: -0.2,
        heartbeatLatencyMs: -100,
        recentFailureRate: 1.2,
      }),
    );

    expect(scored.capacityScore).toBe(1);
    expect(scored.resourceScore).toBe(1);
    expect(scored.latencyScore).toBe(0);
    expect(scored.failureScore).toBe(1);
  });

  it('includes richer explainability reasons for schedulable runners', () => {
    const service = new CapacityScoringService();
    const scored = service.score(
      runner({
        runningCount: 1,
        maxConcurrency: 4,
        cpuUsage: 0.2,
        memoryUsage: 0.6,
        heartbeatLatencyMs: 1000,
        recentFailureRate: 0.3,
      }),
    );

    expect(scored.filtered).toBe(false);
    expect(scored.reasons).toContain('schedulable');
    expect(scored.reasons.some((reason) => reason.startsWith('load:'))).toBe(true);
    expect(scored.reasons.some((reason) => reason.startsWith('resource:'))).toBe(true);
    expect(scored.reasons.some((reason) => reason.startsWith('latency:'))).toBe(true);
    expect(scored.reasons.some((reason) => reason.startsWith('failure:'))).toBe(true);
  });

  it('normalizes non-finite inputs to avoid NaN scoring', () => {
    const service = new CapacityScoringService();
    const scored = service.score(
      runner({
        cpuUsage: Number.NaN,
        memoryUsage: Number.POSITIVE_INFINITY,
        recentFailureRate: Number.NEGATIVE_INFINITY,
        heartbeatLatencyMs: Number.NaN,
        runningCount: Number.POSITIVE_INFINITY,
        maxConcurrency: Number.NaN,
      }),
    );

    expect(Number.isNaN(scored.score)).toBe(false);
    expect(Number.isNaN(scored.capacityScore)).toBe(false);
    expect(Number.isNaN(scored.resourceScore)).toBe(false);
    expect(Number.isNaN(scored.latencyScore)).toBe(false);
    expect(Number.isNaN(scored.failureScore)).toBe(false);
  });

  it('flags invalid concurrency with precise reason', () => {
    const service = new CapacityScoringService();
    const scored = service.score(
      runner({
        maxConcurrency: 0,
        runningCount: 0,
      }),
    );

    expect(scored.filtered).toBe(true);
    expect(scored.reasons).toContain('capacity:full');
    expect(scored.reasons).toContain('capacity:invalid');
  });
});
