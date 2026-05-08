import { IPC_CHANNELS } from '@shared/constants';

type IpcControllerLike = {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
};

type RemoteRunnerServiceLike = {
  listConnections(): unknown;
  saveConnection(payload: unknown): unknown;
  deleteConnection(id: string): unknown;
  testConnection(id: string): unknown;
  listRemoteTasks(payload: unknown): unknown;
  saveRemoteTask(payload: unknown): unknown;
  deleteRemoteTask(payload: unknown): unknown;
  listRemoteSessions(payload: unknown): unknown;
  saveRemoteSession(payload: unknown): unknown;
  deleteRemoteSession(payload: unknown): unknown;
  startExecution(payload: unknown): unknown;
  getExecution(payload: unknown): unknown;
  cancelExecution(payload: unknown): unknown;
  getExecutionLogs(payload: unknown): unknown;
};

export function registerRemoteRunnerHandlers(options: {
  ipcController: IpcControllerLike;
  service: RemoteRunnerServiceLike;
}): void {
  const { ipcController, service } = options;

  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST, () => service.listConnections());
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_SAVE, (payload) => service.saveConnection(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_DELETE, (payload) =>
    service.deleteConnection(assertId(payload)),
  );
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_TEST, (payload) =>
    service.testConnection(assertId(payload)),
  );
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_TASK_LIST, (payload) => service.listRemoteTasks(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_TASK_SAVE, (payload) => service.saveRemoteTask(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_TASK_DELETE, (payload) => service.deleteRemoteTask(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_SESSION_LIST, (payload) => service.listRemoteSessions(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_SESSION_SAVE, (payload) => service.saveRemoteSession(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_SESSION_DELETE, (payload) => service.deleteRemoteSession(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_START, (payload) => service.startExecution(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_GET, (payload) => service.getExecution(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_CANCEL, (payload) => service.cancelExecution(payload));
  ipcController.handle(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_LOGS, (payload) => service.getExecutionLogs(payload));
}

function assertId(payload: unknown): string {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (
    typeof payload === 'object'
    && payload !== null
    && 'id' in payload
    && typeof (payload as { id: unknown }).id === 'string'
  ) {
    return (payload as { id: string }).id;
  }

  throw new Error('id is required');
}
