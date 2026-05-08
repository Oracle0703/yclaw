import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerRunnerSchedulerHandlers } from '@main/ipc/runner-scheduler-handlers';

describe('registerRunnerSchedulerHandlers', () => {
  it('registers all scheduler channels and forwards payload/results', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const listRunnersResult = [{ id: 'runner-1' }];
    const heartbeatResult = { id: 'runner-1', status: 'online' };
    const drainResult = { id: 'runner-1', status: 'draining' };
    const resumeResult = { id: 'runner-1', status: 'online' };
    const listQueueResult = [{ id: 'queue-1', status: 'queued' }];
    const enqueueResult = { id: 'queue-2', status: 'queued' };
    const cancelQueueResult = { id: 'queue-2', status: 'cancelled' };
    const dispatchTickResult = { ok: true };
    const listLeasesResult = [{ id: 'lease-1', status: 'active' }];
    const renewLeaseResult = { id: 'lease-1', status: 'active' };
    const releaseLeaseResult = { id: 'lease-1', status: 'released' };
    const reconcileResult = { orphaned: 1 };
    const service = {
      listRunners: vi.fn(() => listRunnersResult),
      heartbeat: vi.fn(() => heartbeatResult),
      drain: vi.fn(() => drainResult),
      resume: vi.fn(() => resumeResult),
      listQueue: vi.fn(() => listQueueResult),
      enqueue: vi.fn(() => enqueueResult),
      cancelQueueItem: vi.fn(() => cancelQueueResult),
      dispatchTick: vi.fn(() => dispatchTickResult),
      listLeases: vi.fn(() => listLeasesResult),
      renewLease: vi.fn(() => renewLeaseResult),
      releaseLease: vi.fn(() => releaseLeaseResult),
      reconcile: vi.fn(() => reconcileResult),
    };

    registerRunnerSchedulerHandlers({ ipcController, service });

    const channels = [
      IPC_CHANNELS.RUNNER_REGISTRY_LIST,
      IPC_CHANNELS.RUNNER_REGISTRY_HEARTBEAT,
      IPC_CHANNELS.RUNNER_REGISTRY_DRAIN,
      IPC_CHANNELS.RUNNER_REGISTRY_RESUME,
      IPC_CHANNELS.RUNNER_QUEUE_LIST,
      IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE,
      IPC_CHANNELS.RUNNER_QUEUE_CANCEL,
      IPC_CHANNELS.RUNNER_DISPATCH_TICK,
      IPC_CHANNELS.RUNNER_LEASE_LIST,
      IPC_CHANNELS.RUNNER_LEASE_RENEW,
      IPC_CHANNELS.RUNNER_LEASE_RELEASE,
      IPC_CHANNELS.RUNNER_LEASE_RECONCILE,
    ];

    channels.forEach((channel) => {
      expect(ipcController.handle).toHaveBeenCalledWith(channel, expect.any(Function));
      expect(handlers.get(channel)).toBeTypeOf('function');
    });

    const heartbeatPayload = { runnerId: 'runner-1', metrics: { cpuUsage: 0.2 } };
    const drainPayload = { runnerId: 'runner-1' };
    const resumePayload = { runnerId: 'runner-1' };
    const enqueuePayload = { taskId: 'task-1', taskType: 'collect', workspaceId: 'ws-1' };
    const cancelPayload = { queueItemId: 'queue-2' };
    const renewPayload = { leaseId: 'lease-1', leaseTtlMs: 30000 };
    const releasePayload = { leaseId: 'lease-1' };

    expect(await handlers.get(IPC_CHANNELS.RUNNER_REGISTRY_LIST)?.({})).toBe(listRunnersResult);
    expect(service.listRunners).toHaveBeenCalledTimes(1);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_REGISTRY_HEARTBEAT)?.(heartbeatPayload)).toBe(
      heartbeatResult,
    );
    expect(service.heartbeat).toHaveBeenCalledWith(heartbeatPayload);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_REGISTRY_DRAIN)?.(drainPayload)).toBe(drainResult);
    expect(service.drain).toHaveBeenCalledWith(drainPayload);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_REGISTRY_RESUME)?.(resumePayload)).toBe(resumeResult);
    expect(service.resume).toHaveBeenCalledWith(resumePayload);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_QUEUE_LIST)?.({})).toBe(listQueueResult);
    expect(service.listQueue).toHaveBeenCalledTimes(1);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE)?.(enqueuePayload)).toBe(enqueueResult);
    expect(service.enqueue).toHaveBeenCalledWith(enqueuePayload);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_QUEUE_CANCEL)?.(cancelPayload)).toBe(cancelQueueResult);
    expect(service.cancelQueueItem).toHaveBeenCalledWith(cancelPayload);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_DISPATCH_TICK)?.({})).toBe(dispatchTickResult);
    expect(service.dispatchTick).toHaveBeenCalledTimes(1);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_LEASE_LIST)?.({})).toBe(listLeasesResult);
    expect(service.listLeases).toHaveBeenCalledTimes(1);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_LEASE_RENEW)?.(renewPayload)).toBe(renewLeaseResult);
    expect(service.renewLease).toHaveBeenCalledWith(renewPayload);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_LEASE_RELEASE)?.(releasePayload)).toBe(releaseLeaseResult);
    expect(service.releaseLease).toHaveBeenCalledWith(releasePayload);
    expect(await handlers.get(IPC_CHANNELS.RUNNER_LEASE_RECONCILE)?.({})).toBe(reconcileResult);
    expect(service.reconcile).toHaveBeenCalledTimes(1);
  });
});
