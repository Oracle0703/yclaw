import { describe, expect, it, vi } from 'vitest';
import { RemoteRunnerClient } from '@main/remote-runner';

describe('RemoteRunnerClient', () => {
  it('sends token, workspace, actor, and parses runner info', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        runnerId: 'runner-1',
        name: 'Runner 1',
        version: '1.0.0',
        protocolVersion: 1,
        capabilities: ['browser-automation', 'log-stream'],
        limits: {
          maxConcurrency: 2,
          maxTaskTimeoutMs: 300000,
          maxStepTimeoutMs: 30000,
          maxLogRetentionHours: 24,
        },
        serverTime: '2026-04-20T00:00:00.000Z',
      }),
    });

    const client = new RemoteRunnerClient({
      baseUrl: 'http://127.0.0.1:7421',
      token: 'secret',
      workspaceId: 'default',
      actorId: 'desktop',
      fetchImpl: fetchMock,
    });

    await expect(client.getInfo()).resolves.toMatchObject({ runnerId: 'runner-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:7421/v1/runner/info',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
          'X-YClaw-Workspace': 'default',
          'X-YClaw-Actor': 'desktop',
        }),
      }),
    );
  });

  it('maps error envelopes to thrown errors without leaking token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'auth_failed',
          message: 'Runner token is invalid',
        },
      }),
    });

    const client = new RemoteRunnerClient({
      baseUrl: 'http://127.0.0.1:7421/',
      token: 'secret-token-value',
      workspaceId: 'default',
      actorId: 'desktop',
      fetchImpl: fetchMock,
    });

    await expect(client.getInfo()).rejects.toMatchObject({
      code: 'auth_failed',
      message: 'Runner token is invalid',
    });
    await expect(client.getInfo()).rejects.not.toThrow('secret-token-value');
  });

  it('creates and deletes remote sessions through the session API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'session-1',
          name: 'Shop Login',
          origin: 'https://shop.example',
          status: 'unknown',
          lastValidatedAt: null,
          expiresAt: null,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    const client = new RemoteRunnerClient({
      baseUrl: 'http://127.0.0.1:7421',
      token: 'secret',
      workspaceId: 'default',
      actorId: 'desktop',
      fetchImpl: fetchMock,
    });

    await expect(client.createSession({
      name: 'Shop Login',
      origin: 'https://shop.example',
      expiresAt: null,
    })).resolves.toMatchObject({ id: 'session-1' });
    await expect(client.deleteSession('session-1')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:7421/v1/sessions',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:7421/v1/sessions/session-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('returns health metrics for typed consumers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        queuedCount: 1,
        runningCount: 0,
        lastError: null,
        checkedAt: '2026-04-21T00:00:00.000Z',
        metrics: {
          maxConcurrency: 1,
          runningCount: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          heartbeatLatencyMs: 0,
          recentFailureRate: 0,
        },
      }),
    });

    const client = new RemoteRunnerClient({
      baseUrl: 'http://127.0.0.1:7421',
      token: 'secret',
      workspaceId: 'default',
      actorId: 'desktop',
      fetchImpl: fetchMock,
    });

    const health = await client.getHealth();
    const maxConcurrency: number = health.metrics.maxConcurrency;

    expect(maxConcurrency).toBe(1);
    expect(health.metrics.heartbeatLatencyMs).toBe(0);
  });
});
