import { IPC_CHANNELS } from '../../../shared/constants';
import type { RunnerConnection } from '../../../shared/types';

type Invoke = (channel: string, payload?: unknown) => Promise<unknown>;

export function createRemoteRunnerApi(options: { invoke: Invoke }) {
  return {
    listConnections: () =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST) as Promise<RunnerConnection[]>,
    saveConnection: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_SAVE, payload) as Promise<RunnerConnection>,
    deleteConnection: (id: string) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_DELETE, { id }) as Promise<void>,
    testConnection: (id: string) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_TEST, { id }) as Promise<unknown>,
    listRemoteTasks: (payload: { runnerConnectionId: string }) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_TASK_LIST, payload) as Promise<unknown>,
    saveRemoteTask: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_TASK_SAVE, payload) as Promise<unknown>,
    deleteRemoteTask: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_TASK_DELETE, payload) as Promise<void>,
    listRemoteSessions: (payload: { runnerConnectionId: string }) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_SESSION_LIST, payload) as Promise<unknown>,
    saveRemoteSession: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_SESSION_SAVE, payload) as Promise<unknown>,
    deleteRemoteSession: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_SESSION_DELETE, payload) as Promise<void>,
    startExecution: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_START, payload) as Promise<unknown>,
    getExecution: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_GET, payload) as Promise<unknown>,
    cancelExecution: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_CANCEL, payload) as Promise<unknown>,
    getExecutionLogs: (payload: unknown) =>
      options.invoke(IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_LOGS, payload) as Promise<unknown>,
  };
}
