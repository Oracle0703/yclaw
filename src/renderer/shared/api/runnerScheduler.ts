import { IPC_CHANNELS } from '../../../shared/constants';
import type { ExecutionLease, RunnerNode, RunnerQueueItem } from '../../../shared/types';

type Invoke = (channel: string, payload?: unknown) => Promise<unknown>;

export function createRunnerSchedulerApi(options: { invoke: Invoke }) {
  return {
    listRunners: () =>
      options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_LIST) as Promise<RunnerNode[]>,
    heartbeat: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_HEARTBEAT, payload) as Promise<unknown>,
    drain: (runnerId: string) =>
      options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_DRAIN, { runnerId }) as Promise<unknown>,
    resume: (runnerId: string) =>
      options.invoke(IPC_CHANNELS.RUNNER_REGISTRY_RESUME, { runnerId }) as Promise<unknown>,
    listQueue: () => options.invoke(IPC_CHANNELS.RUNNER_QUEUE_LIST) as Promise<RunnerQueueItem[]>,
    enqueue: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE, payload) as Promise<unknown>,
    cancelQueueItem: (queueItemId: string) =>
      options.invoke(IPC_CHANNELS.RUNNER_QUEUE_CANCEL, { queueItemId }) as Promise<void>,
    dispatchTick: () => options.invoke(IPC_CHANNELS.RUNNER_DISPATCH_TICK) as Promise<unknown>,
    listLeases: () => options.invoke(IPC_CHANNELS.RUNNER_LEASE_LIST) as Promise<ExecutionLease[]>,
    reconcile: () => options.invoke(IPC_CHANNELS.RUNNER_LEASE_RECONCILE) as Promise<unknown>,
  };
}
