import { describe, expect, it, vi } from 'vitest';
import { RunnerRegistryService } from '@main/services/runner-scheduler/RunnerRegistryService';
import type { RunnerNode } from '@shared/types';

describe('RunnerRegistryService', () => {
  const now = new Date('2026-04-21T00:01:00.000Z');
  const staleHeartbeat = '2026-04-21T00:00:00.000Z';
  const freshHeartbeat = '2026-04-21T00:00:45.000Z';
  const repository = () => ({
    saveRunnerNode: vi.fn((node: RunnerNode) => node),
    listRunnerNodes: vi.fn(() => [] as RunnerNode[]),
    saveHealthSample: vi.fn(),
    saveDispatchEvent: vi.fn(),
  });
  const runner = (overrides: Partial<RunnerNode> = {}): RunnerNode => ({
    id: 'remote',
    kind: 'remote',
    name: 'Remote',
    workspaceId: 'default',
    status: 'online',
    capabilities: [],
    maxConcurrency: 1,
    runningCount: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    heartbeatLatencyMs: 0,
    recentFailureRate: 0,
    lastHeartbeatAt: freshHeartbeat,
    lastSeenAt: freshHeartbeat,
    createdAt: staleHeartbeat,
    updatedAt: staleHeartbeat,
    ...overrides,
  });

  it('registers local runner with online status', () => {
    const repo = repository();
    const service = new RunnerRegistryService({ repository: repo, now: () => now });
    const node = service.registerLocalRunner({ id: 'local', name: 'Local', workspaceId: 'default', maxConcurrency: 2 });
    expect(node.status).toBe('online');
    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'local', kind: 'local' }));
  });

  it('marks stale runners offline during health tick', () => {
    const stale = runner({
      lastHeartbeatAt: staleHeartbeat,
      lastSeenAt: staleHeartbeat,
      updatedAt: staleHeartbeat,
    });
    const repo = repository();
    repo.listRunnerNodes.mockReturnValue([stale]);
    const service = new RunnerRegistryService({ repository: repo, now: () => now });
    service.healthTick();
    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'remote', status: 'offline' }));
  });

  it('allows offline runner to recover on heartbeat', () => {
    const repo = repository();
    repo.listRunnerNodes.mockReturnValue([runner({ status: 'offline', lastHeartbeatAt: staleHeartbeat })]);
    const service = new RunnerRegistryService({ repository: repo, now: () => now });

    const recovered = service.heartbeat('remote', { cpuUsage: 0.2, memoryUsage: 0.2, recentFailureRate: 0.1 });

    expect(recovered?.status).toBe('online');
    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'remote', status: 'online' }));
    expect(repo.saveDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'status_change',
        runnerId: 'remote',
        metadata: expect.objectContaining({ previousStatus: 'offline', status: 'online', source: 'heartbeat' }),
      }),
    );
  });

  it('marks runner degraded on heartbeat when metrics breach threshold', () => {
    const repo = repository();
    repo.listRunnerNodes.mockReturnValue([runner()]);
    const service = new RunnerRegistryService({ repository: repo, now: () => now });

    const next = service.heartbeat('remote', { cpuUsage: 0.95 });

    expect(next?.status).toBe('degraded');
    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ status: 'degraded' }));
  });

  it('records degraded transition during health tick with status_change event', () => {
    const repo = repository();
    repo.listRunnerNodes.mockReturnValue([runner({ cpuUsage: 0.95, status: 'online' })]);
    const service = new RunnerRegistryService({ repository: repo, now: () => now });

    service.healthTick();

    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ status: 'degraded' }));
    expect(repo.saveDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'status_change',
        metadata: expect.objectContaining({ status: 'degraded' }),
      }),
    );
  });

  it('emits dispatch events for drain and resume operations', () => {
    const repo = repository();
    repo.listRunnerNodes.mockReturnValue([runner({ status: 'online' })]);
    const service = new RunnerRegistryService({ repository: repo, now: () => now });

    service.drain('remote');
    service.resume('remote');

    expect(repo.saveDispatchEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ eventType: 'drain', runnerId: 'remote' }),
    );
    expect(repo.saveDispatchEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ eventType: 'resume', runnerId: 'remote' }),
    );
  });

  it('resume does not force stale runner online', () => {
    const repo = repository();
    repo.listRunnerNodes.mockReturnValue([runner({ status: 'draining', lastHeartbeatAt: staleHeartbeat })]);
    const service = new RunnerRegistryService({ repository: repo, now: () => now });

    const resumed = service.resume('remote');

    expect(resumed?.status).toBe('offline');
    expect(repo.saveRunnerNode).toHaveBeenCalledWith(expect.objectContaining({ status: 'offline' }));
  });
});
