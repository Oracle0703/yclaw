import { describe, expect, it } from 'vitest';
import {
  REMOTE_RUNNER_PROTOCOL_VERSION,
  REMOTE_RUNNER_STATUSES,
  sanitizeRunnerConnection,
  toRemoteRunnerError,
} from '@shared/constants/remote-runner';
import type { RunnerConnection, RemoteExecutionStatus } from '@shared/types/remote-runner';

describe('remote runner shared contract', () => {
  it('uses protocol version 1', () => {
    expect(REMOTE_RUNNER_PROTOCOL_VERSION).toBe(1);
  });

  it('contains every execution terminal and active status', () => {
    const statuses = REMOTE_RUNNER_STATUSES satisfies readonly RemoteExecutionStatus[];
    expect(statuses).toEqual([
      'queued',
      'running',
      'succeeded',
      'failed',
      'canceled',
      'timeout',
      'interrupted',
    ]);
  });

  it('sanitizes token references before returning connections to renderer', () => {
    const connection: RunnerConnection = {
      id: 'runner-local',
      name: 'Local Runner',
      baseUrl: 'http://127.0.0.1:7421',
      authType: 'token',
      tokenRef: 'secret-token-value',
      workspaceId: 'default',
      tlsMode: 'insecure-dev',
      proxyUrl: null,
      status: 'online',
      lastSeenAt: null,
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    };

    expect(sanitizeRunnerConnection(connection)).toEqual({
      ...connection,
      tokenRef: '***',
    });
  });

  it('normalizes unknown failures into runner_unavailable', () => {
    expect(toRemoteRunnerError(new Error('network down')).code).toBe('runner_unavailable');
  });
});
