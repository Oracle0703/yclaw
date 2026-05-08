import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { createRemoteRunnerApi } from '@renderer/shared/api/remoteRunner';

describe('createRemoteRunnerApi', () => {
  it('invokes connection list channel', async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    const api = createRemoteRunnerApi({ invoke });
    await expect(api.listConnections()).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.REMOTE_RUNNER_CONNECTION_LIST);
  });
});
