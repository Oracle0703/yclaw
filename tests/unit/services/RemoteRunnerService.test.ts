import { describe, expect, it, vi } from 'vitest';
import { RemoteRunnerService } from '@main/services/RemoteRunnerService';

describe('RemoteRunnerService', () => {
  it('saves connections and returns sanitized records', async () => {
    const repository = {
      list: vi.fn().mockReturnValue([]),
      save: vi.fn((connection) => connection),
      delete: vi.fn(),
      get: vi.fn(),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(),
      actorId: 'desktop',
    });

    const saved = await service.saveConnection({
      name: 'Local Runner',
      baseUrl: 'http://127.0.0.1:7421',
      token: 'secret-token-value',
      workspaceId: 'default',
      tlsMode: 'insecure-dev',
      proxyUrl: null,
    });

    expect(saved.tokenRef).toBe('***');
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ tokenRef: 'secret-token-value' }));
  });

  it.each([
    ['file:///etc/passwd'],
    ['javascript:alert(1)'],
    ['ftp://example.com'],
    ['not-a-url'],
    [''],
  ])('rejects unsafe baseUrl %j', async (baseUrl) => {
    const repository = {
      list: vi.fn().mockReturnValue([]),
      save: vi.fn((connection) => connection),
      delete: vi.fn(),
      get: vi.fn(),
    };
    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(),
      actorId: 'desktop',
    });

    await expect(
      service.saveConnection({
        name: 'Bad runner',
        baseUrl,
        token: 'tok',
        workspaceId: 'default',
        tlsMode: 'insecure-dev',
        proxyUrl: null,
      }),
    ).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('marks a connection online after successful probe', async () => {
    const repository = {
      list: vi.fn(),
      save: vi.fn((connection) => connection),
      delete: vi.fn(),
      get: vi.fn().mockReturnValue({
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
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      }),
    };
    const client = {
      getInfo: vi.fn().mockResolvedValue({
        protocolVersion: 1,
        runnerId: 'runner-1',
        name: 'Runner 1',
        version: '1.0.0',
        capabilities: [],
        limits: {
          maxConcurrency: 1,
          maxTaskTimeoutMs: 300000,
          maxStepTimeoutMs: 30000,
          maxLogRetentionHours: 24,
        },
        serverTime: '2026-04-20T00:00:00.000Z',
      }),
      getHealth: vi.fn().mockResolvedValue({
        status: 'ok',
        queuedCount: 0,
        runningCount: 0,
        lastError: null,
        checkedAt: '2026-04-20T00:00:00.000Z',
      }),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(() => client),
      actorId: 'desktop',
    });

    await expect(service.testConnection('runner-local')).resolves.toMatchObject({
      connection: expect.objectContaining({ status: 'online', tokenRef: '***' }),
      info: expect.objectContaining({ runnerId: 'runner-1' }),
    });
  });

  it('returns fallback health metrics when protocol is incompatible', async () => {
    const repository = {
      list: vi.fn(),
      save: vi.fn((connection) => connection),
      delete: vi.fn(),
      get: vi.fn().mockReturnValue({
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
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      }),
    };
    const client = {
      getInfo: vi.fn().mockResolvedValue({
        protocolVersion: 999,
        runnerId: 'runner-legacy',
        name: 'Runner Legacy',
        version: '0.9.0',
        capabilities: [],
        limits: {
          maxConcurrency: 3,
          maxTaskTimeoutMs: 300000,
          maxStepTimeoutMs: 30000,
          maxLogRetentionHours: 24,
        },
        serverTime: '2026-04-20T00:00:00.000Z',
      }),
      getHealth: vi.fn(),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(() => client),
      actorId: 'desktop',
    });

    const result = await service.testConnection('runner-local');

    expect(result.connection.status).toBe('incompatible');
    expect(result.health).toMatchObject({
      status: 'degraded',
      queuedCount: 0,
      runningCount: 0,
      lastError: 'protocol_incompatible',
      metrics: {
        maxConcurrency: 3,
        runningCount: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        heartbeatLatencyMs: 0,
        recentFailureRate: 0,
      },
    });
    expect(client.getHealth).not.toHaveBeenCalled();
  });

  it('starts execution through selected runner connection', async () => {
    const repository = {
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      get: vi.fn().mockReturnValue({
        id: 'runner-local',
        name: 'Local Runner',
        baseUrl: 'http://127.0.0.1:7421',
        authType: 'token',
        tokenRef: 'secret',
        workspaceId: 'default',
        tlsMode: 'insecure-dev',
        proxyUrl: null,
        status: 'online',
        lastSeenAt: null,
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      }),
    };
    const client = {
      getInfo: vi.fn(),
      getHealth: vi.fn(),
      startExecution: vi.fn().mockResolvedValue({
        id: 'exec-1',
        taskId: 'task-1',
        revisionId: 'rev-1',
        status: 'queued',
      }),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(() => client as never),
      actorId: 'desktop',
    });

    await expect(
      service.startExecution({
        runnerConnectionId: 'runner-local',
        taskId: 'task-1',
        revisionId: 'rev-1',
      }),
    ).resolves.toMatchObject({ id: 'exec-1', status: 'queued' });
  });

  it('creates and deletes remote sessions through selected runner connection', async () => {
    const repository = {
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      get: vi.fn().mockReturnValue({
        id: 'runner-local',
        name: 'Local Runner',
        baseUrl: 'http://127.0.0.1:7421',
        authType: 'token',
        tokenRef: 'secret',
        workspaceId: 'default',
        tlsMode: 'insecure-dev',
        proxyUrl: null,
        status: 'online',
        lastSeenAt: null,
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      }),
    };
    const client = {
      getInfo: vi.fn(),
      getHealth: vi.fn(),
      createSession: vi.fn().mockResolvedValue({
        id: 'session-1',
        name: 'Shop Login',
        origin: 'https://shop.example',
      }),
      deleteSession: vi.fn().mockResolvedValue({ ok: true }),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(() => client as never),
      actorId: 'desktop',
    });

    await expect(
      service.saveRemoteSession({
        runnerConnectionId: 'runner-local',
        data: {
          name: 'Shop Login',
          origin: 'https://shop.example',
          expiresAt: null,
        },
      }),
    ).resolves.toMatchObject({ id: 'session-1' });
    await expect(
      service.deleteRemoteSession({
        runnerConnectionId: 'runner-local',
        sessionId: 'session-1',
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects invalid remote task and session payloads before calling the runner client', async () => {
    const repository = {
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      get: vi.fn().mockReturnValue({
        id: 'runner-local',
        name: 'Local Runner',
        baseUrl: 'http://127.0.0.1:7421',
        authType: 'token',
        tokenRef: 'secret',
        workspaceId: 'default',
        tlsMode: 'insecure-dev',
        proxyUrl: null,
        status: 'online',
        lastSeenAt: null,
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      }),
    };
    const client = {
      getInfo: vi.fn(),
      getHealth: vi.fn(),
      createTask: vi.fn().mockResolvedValue({ ok: true }),
      createSession: vi.fn().mockResolvedValue({ ok: true }),
    };

    const service = new RemoteRunnerService({
      repository,
      createClient: vi.fn(() => client as never),
      actorId: 'desktop',
    });

    await expect(
      service.saveRemoteTask({
        runnerConnectionId: 'runner-local',
        data: { name: 'Missing flow' },
      }),
    ).rejects.toThrow('flow is required');
    await expect(
      service.saveRemoteSession({
        runnerConnectionId: 'runner-local',
        data: { name: 'Missing origin' },
      }),
    ).rejects.toThrow('origin is required');
    expect(client.createTask).not.toHaveBeenCalled();
    expect(client.createSession).not.toHaveBeenCalled();
  });
});
