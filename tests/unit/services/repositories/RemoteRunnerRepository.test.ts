import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunnerConnection } from '@shared/types';
import { RemoteRunnerRepository } from '@main/services/repositories/RemoteRunnerRepository';

function createExecutor() {
  return {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  };
}

describe('RemoteRunnerRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: RemoteRunnerRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new RemoteRunnerRepository(executor);
  });

  it('persists a runner connection record', () => {
    const connection: RunnerConnection = {
      id: 'runner-local',
      name: 'Local Runner',
      baseUrl: 'http://127.0.0.1:7421',
      authType: 'token',
      tokenRef: 'secret',
      workspaceId: 'default',
      tlsMode: 'insecure-dev',
      proxyUrl: null,
      status: 'unknown',
      lastSeenAt: null,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    };

    repository.save(connection);

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO remote_runner_connections'),
      [
        connection.id,
        connection.name,
        connection.baseUrl,
        connection.authType,
        connection.tokenRef,
        connection.workspaceId,
        connection.tlsMode,
        connection.proxyUrl,
        connection.status,
        connection.lastSeenAt,
        connection.createdAt,
        connection.updatedAt,
      ],
    );
  });

  it('maps stored rows into runner connections', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'runner-local',
        name: 'Local Runner',
        base_url: 'http://127.0.0.1:7421',
        auth_type: 'token',
        token_ref: 'secret',
        workspace_id: 'default',
        tls_mode: 'insecure-dev',
        proxy_url: null,
        status: 'online',
        last_seen_at: '2026-04-21T01:00:00.000Z',
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T01:00:00.000Z',
      },
    ]);
    executor.get.mockReturnValueOnce({
      id: 'runner-local',
      name: 'Local Runner',
      base_url: 'http://127.0.0.1:7421',
      auth_type: 'token',
      token_ref: 'secret',
      workspace_id: 'default',
      tls_mode: 'insecure-dev',
      proxy_url: null,
      status: 'online',
      last_seen_at: '2026-04-21T01:00:00.000Z',
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T01:00:00.000Z',
    });

    expect(repository.list()).toEqual([
      {
        id: 'runner-local',
        name: 'Local Runner',
        baseUrl: 'http://127.0.0.1:7421',
        authType: 'token',
        tokenRef: 'secret',
        workspaceId: 'default',
        tlsMode: 'insecure-dev',
        proxyUrl: null,
        status: 'online',
        lastSeenAt: '2026-04-21T01:00:00.000Z',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T01:00:00.000Z',
      },
    ]);

    expect(repository.get('runner-local')).toEqual({
      id: 'runner-local',
      name: 'Local Runner',
      baseUrl: 'http://127.0.0.1:7421',
      authType: 'token',
      tokenRef: 'secret',
      workspaceId: 'default',
      tlsMode: 'insecure-dev',
      proxyUrl: null,
      status: 'online',
      lastSeenAt: '2026-04-21T01:00:00.000Z',
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T01:00:00.000Z',
    });
  });

  it('deletes records by id', () => {
    repository.delete('runner-local');

    expect(executor.run).toHaveBeenCalledWith(
      'DELETE FROM remote_runner_connections WHERE id = ?',
      ['runner-local'],
    );
  });
});
