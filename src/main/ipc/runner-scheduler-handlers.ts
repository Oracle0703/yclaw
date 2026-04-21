import { IPC_CHANNELS } from '@shared/constants';

interface IpcControllerLike {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
}

interface RunnerSchedulerFacade {
  listRunners(): unknown;
  heartbeat(payload: unknown): unknown;
  drain(payload: unknown): unknown;
  resume(payload: unknown): unknown;
  listQueue(): unknown;
  enqueue(payload: unknown): unknown;
  cancelQueueItem(payload: unknown): unknown;
  dispatchTick(): unknown;
  listLeases(): unknown;
  renewLease(payload: unknown): unknown;
  releaseLease(payload: unknown): unknown;
  reconcile(): unknown;
}

export function registerRunnerSchedulerHandlers(options: {
  ipcController: IpcControllerLike;
  service: RunnerSchedulerFacade;
}): void {
  const { ipcController, service } = options;

  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_LIST, () => service.listRunners());
  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_HEARTBEAT, (payload) => service.heartbeat(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_DRAIN, (payload) => service.drain(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_REGISTRY_RESUME, (payload) => service.resume(payload));

  ipcController.handle(IPC_CHANNELS.RUNNER_QUEUE_LIST, () => service.listQueue());
  ipcController.handle(IPC_CHANNELS.RUNNER_QUEUE_ENQUEUE, (payload) => service.enqueue(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_QUEUE_CANCEL, (payload) => service.cancelQueueItem(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_DISPATCH_TICK, () => service.dispatchTick());

  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_LIST, () => service.listLeases());
  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_RENEW, (payload) => service.renewLease(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_RELEASE, (payload) => service.releaseLease(payload));
  ipcController.handle(IPC_CHANNELS.RUNNER_LEASE_RECONCILE, () => service.reconcile());
}
