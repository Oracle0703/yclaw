import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { createRunnerSchedulerApi } from '@renderer/shared/api/runnerScheduler';

describe('createRunnerSchedulerApi', () => {
  it.each([
    {
      name: 'listRunners',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.listRunners(),
      channel: IPC_CHANNELS.RUNNER_REGISTRY_LIST,
    },
    {
      name: 'listQueue',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.listQueue(),
      channel: IPC_CHANNELS.RUNNER_QUEUE_LIST,
    },
    {
      name: 'listLeases',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.listLeases(),
      channel: IPC_CHANNELS.RUNNER_LEASE_LIST,
    },
    {
      name: 'drain',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.drain('runner-1'),
      channel: IPC_CHANNELS.RUNNER_REGISTRY_DRAIN,
      payload: { runnerId: 'runner-1' },
    },
    {
      name: 'resume',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.resume('runner-1'),
      channel: IPC_CHANNELS.RUNNER_REGISTRY_RESUME,
      payload: { runnerId: 'runner-1' },
    },
    {
      name: 'cancelQueueItem',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.cancelQueueItem('queue-1'),
      channel: IPC_CHANNELS.RUNNER_QUEUE_CANCEL,
      payload: { queueItemId: 'queue-1' },
    },
    {
      name: 'dispatchTick',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.dispatchTick(),
      channel: IPC_CHANNELS.RUNNER_DISPATCH_TICK,
    },
    {
      name: 'reconcile',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.reconcile(),
      channel: IPC_CHANNELS.RUNNER_LEASE_RECONCILE,
    },
    {
      name: 'heartbeat',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.heartbeat({ runnerId: 'runner-1' }),
      channel: IPC_CHANNELS.RUNNER_REGISTRY_HEARTBEAT,
      payload: { runnerId: 'runner-1' },
    },
    {
      name: 'enqueue',
      run: (api: ReturnType<typeof createRunnerSchedulerApi>) => api.enqueue({ taskId: 'task-1' }),
      channel: IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE,
      payload: { taskId: 'task-1' },
    },
  ])('invokes expected channel for $name', async ({ run, channel, payload }) => {
    const invoke = vi.fn().mockResolvedValue(null);
    const api = createRunnerSchedulerApi({ invoke });

    await expect(run(api)).resolves.toBeNull();
    if (payload === undefined) {
      expect(invoke).toHaveBeenCalledWith(channel);
      return;
    }
    expect(invoke).toHaveBeenCalledWith(channel, payload);
  });
});
