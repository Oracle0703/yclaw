import crypto from 'crypto';
import { RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';
import type { RunnerDispatchEvent, RunnerHealthSample, RunnerNode } from '@shared/types';

interface RepositoryLike {
  saveRunnerNode(node: RunnerNode): RunnerNode;
  listRunnerNodes(): RunnerNode[];
  saveHealthSample(sample: RunnerHealthSample): RunnerHealthSample;
  saveDispatchEvent(event: RunnerDispatchEvent): RunnerDispatchEvent;
}

interface RegisterLocalRunnerInput {
  id: string;
  name: string;
  workspaceId: string;
  maxConcurrency: number;
}

export class RunnerRegistryService {
  constructor(private readonly options: { repository: RepositoryLike; now?: () => Date }) {}

  registerLocalRunner(input: RegisterLocalRunnerInput): RunnerNode {
    const timestamp = this.nowIso();
    return this.options.repository.saveRunnerNode({
      id: input.id,
      kind: 'local',
      name: input.name,
      workspaceId: input.workspaceId,
      status: 'online',
      capabilities: ['browser-automation', 'sessions'],
      maxConcurrency: input.maxConcurrency,
      runningCount: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      heartbeatLatencyMs: 0,
      recentFailureRate: 0,
      lastHeartbeatAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  heartbeat(
    runnerId: string,
    metrics: Partial<
      Pick<RunnerNode, 'runningCount' | 'cpuUsage' | 'memoryUsage' | 'heartbeatLatencyMs' | 'recentFailureRate'>
    >,
  ): RunnerNode | null {
    const current = this.options.repository.listRunnerNodes().find((node) => node.id === runnerId);
    if (!current) return null;
    const timestamp = this.nowIso();
    const heartbeatStatus = current.status === 'draining'
      ? 'draining'
      : this.deriveStatus({ ...current, ...metrics, status: 'online' });
    const next: RunnerNode = {
      ...current,
      ...metrics,
      status: heartbeatStatus,
      lastHeartbeatAt: timestamp,
      lastSeenAt: timestamp,
      updatedAt: timestamp,
    };
    this.options.repository.saveRunnerNode(next);
    if (next.status !== current.status) {
      this.options.repository.saveDispatchEvent({
        id: crypto.randomUUID(),
        eventType: 'status_change',
        runnerId: next.id,
        queueItemId: null,
        executionId: null,
        message: `Runner ${next.id} changed to ${next.status}`,
        metadata: { source: 'heartbeat', previousStatus: current.status, status: next.status },
        createdAt: timestamp,
      });
    }
    this.options.repository.saveHealthSample(this.toHealthSample(next, timestamp));
    return next;
  }

  healthTick(): RunnerNode[] {
    const now = this.options.now?.() ?? new Date();
    return this.options.repository.listRunnerNodes().map((node) => {
      const stale = this.isStale(node, now);
      let status: RunnerNode['status'];
      if (node.status === 'draining') {
        status = 'draining';
      } else if (stale || node.status === 'offline') {
        status = 'offline';
      } else {
        status = this.deriveStatus(node);
      }
      const next = { ...node, status, updatedAt: now.toISOString() };
      if (next.status !== node.status) {
        this.options.repository.saveDispatchEvent({
          id: crypto.randomUUID(),
          eventType: 'status_change',
          runnerId: node.id,
          queueItemId: null,
          executionId: null,
          message: `Runner ${node.id} changed to ${status}`,
          metadata: { source: 'health-tick', previousStatus: node.status, status, stale },
          createdAt: now.toISOString(),
        });
      }
      this.options.repository.saveRunnerNode(next);
      this.options.repository.saveHealthSample(this.toHealthSample(next, now.toISOString()));
      return next;
    });
  }

  drain(runnerId: string): RunnerNode | null {
    const current = this.options.repository.listRunnerNodes().find((node) => node.id === runnerId);
    if (!current) return null;
    const timestamp = this.nowIso();
    const next: RunnerNode = { ...current, status: 'draining', updatedAt: timestamp };
    this.options.repository.saveRunnerNode(next);
    this.options.repository.saveDispatchEvent({
      id: crypto.randomUUID(),
      eventType: 'drain',
      runnerId: runnerId,
      queueItemId: null,
      executionId: null,
      message: `Runner ${runnerId} entered draining mode`,
      metadata: { source: 'manual', previousStatus: current.status, status: next.status },
      createdAt: timestamp,
    });
    return next;
  }

  resume(runnerId: string): RunnerNode | null {
    const current = this.options.repository.listRunnerNodes().find((node) => node.id === runnerId);
    if (!current) return null;
    const now = this.options.now?.() ?? new Date();
    const stale = this.isStale(current, now);
    const status = stale ? 'offline' : this.deriveStatus({ ...current, status: 'online' });
    const next: RunnerNode = { ...current, status, updatedAt: now.toISOString() };
    this.options.repository.saveRunnerNode(next);
    this.options.repository.saveDispatchEvent({
      id: crypto.randomUUID(),
      eventType: 'resume',
      runnerId,
      queueItemId: null,
      executionId: null,
      message: `Runner ${runnerId} resume requested`,
      metadata: { source: 'manual', previousStatus: current.status, status: next.status, stale },
      createdAt: now.toISOString(),
    });
    return next;
  }

  listSchedulable(workspaceId: string): RunnerNode[] {
    return this.options.repository.listRunnerNodes().filter((node) => node.workspaceId === workspaceId);
  }

  private deriveStatus(
    node: Pick<RunnerNode, 'cpuUsage' | 'memoryUsage' | 'recentFailureRate' | 'status'>,
  ): RunnerNode['status'] {
    if (node.status === 'draining') return node.status;
    if (node.cpuUsage >= 0.9 || node.memoryUsage >= 0.9 || node.recentFailureRate >= 0.5) return 'degraded';
    return 'online';
  }

  private toHealthSample(node: RunnerNode, sampledAt: string): RunnerHealthSample {
    return {
      id: crypto.randomUUID(),
      runnerId: node.id,
      cpuUsage: node.cpuUsage,
      memoryUsage: node.memoryUsage,
      runningCount: node.runningCount,
      maxConcurrency: node.maxConcurrency,
      heartbeatLatencyMs: node.heartbeatLatencyMs,
      recentFailureRate: node.recentFailureRate,
      sampledAt,
    };
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private isStale(node: Pick<RunnerNode, 'lastHeartbeatAt'>, now: Date): boolean {
    const lastHeartbeat = node.lastHeartbeatAt ? new Date(node.lastHeartbeatAt).getTime() : 0;
    return now.getTime() - lastHeartbeat > RUNNER_SCHEDULER_DEFAULTS.heartbeatTimeoutMs;
  }
}
