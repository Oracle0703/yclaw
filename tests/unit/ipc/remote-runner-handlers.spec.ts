import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerRemoteRunnerHandlers } from '@main/ipc/remote-runner-handlers';

describe('registerRemoteRunnerHandlers', () => {
  it('registers connection and execution channels', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const service = {
      listConnections: vi.fn().mockReturnValue([]),
      saveConnection: vi.fn(),
      deleteConnection: vi.fn(),
      testConnection: vi.fn(),
      listRemoteTasks: vi.fn(),
      saveRemoteTask: vi.fn(),
      deleteRemoteTask: vi.fn(),
      listRemoteSessions: vi.fn(),
      saveRemoteSession: vi.fn(),
      deleteRemoteSession: vi.fn(),
      startExecution: vi.fn(),
      getExecution: vi.fn(),
      cancelExecution: vi.fn(),
      getExecutionLogs: vi.fn(),
    };

    registerRemoteRunnerHandlers({ ipcController, service });

    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST,
      expect.any(Function),
    );
    expect(ipcController.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.REMOTE_RUNNER_EXECUTION_START,
      expect.any(Function),
    );
    await handlers.get(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST)?.({});
    expect(service.listConnections).toHaveBeenCalled();
  });
});
