import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryRemoteRunnerRuntime, createRemoteRunnerServer } from '@runner/daemon';

describe('Remote Runner daemon', () => {
  const servers: Array<{ close(): Promise<void>; url: string }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  it('serves info, task creation, execution start, logs, and cancel', async () => {
    const server = await createRemoteRunnerServer({
      token: 'secret',
      workspaceId: 'default',
      port: 0,
    });
    servers.push(server);

    const headers = {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
      'X-YClaw-Workspace': 'default',
      'X-YClaw-Actor': 'test',
    };

    const info = await fetch(`${server.url}/v1/runner/info`, { headers }).then((res) => res.json());
    expect(info.protocolVersion).toBe(1);

    const created = await fetch(`${server.url}/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Remote smoke task',
        tags: [],
        flow: {
          id: 'flow-1',
          name: 'Remote smoke task',
          steps: [],
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      }),
    }).then((res) => res.json());

    const execution = await fetch(`${server.url}/v1/executions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        taskId: created.task.id,
        revisionId: created.revision.revisionId,
      }),
    }).then((res) => res.json());

    expect(execution.status).toBe('queued');

    const logs = await fetch(`${server.url}/v1/executions/${execution.id}/logs`, {
      headers,
    }).then((res) => res.json());
    expect(logs[0].message).toContain('queued');

    const canceled = await fetch(`${server.url}/v1/executions/${execution.id}/cancel`, {
      method: 'POST',
      headers,
    }).then((res) => res.json());
    expect(canceled.status).toBe('canceled');
  });

  it('rejects invalid token without exposing expected token', async () => {
    const server = await createRemoteRunnerServer({
      token: 'secret',
      workspaceId: 'default',
      port: 0,
    });
    servers.push(server);

    const response = await fetch(`${server.url}/v1/runner/info`, {
      headers: {
        Authorization: 'Bearer wrong',
        'X-YClaw-Workspace': 'default',
        'X-YClaw-Actor': 'test',
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('auth_failed');
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('creates, validates, and deletes remote sessions', async () => {
    const server = await createRemoteRunnerServer({
      token: 'secret',
      workspaceId: 'default',
      port: 0,
    });
    servers.push(server);

    const headers = {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
      'X-YClaw-Workspace': 'default',
      'X-YClaw-Actor': 'test',
    };

    const session = await fetch(`${server.url}/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Shop Login',
        origin: 'https://shop.example',
        expiresAt: null,
      }),
    }).then((res) => res.json());
    expect(session.status).toBe('unknown');

    const validated = await fetch(`${server.url}/v1/sessions/${session.id}/validate`, {
      method: 'POST',
      headers,
    }).then((res) => res.json());
    expect(validated.status).toBe('valid');

    const deleted = await fetch(`${server.url}/v1/sessions/${session.id}`, {
      method: 'DELETE',
      headers,
    }).then((res) => res.json());
    expect(deleted).toEqual({ ok: true });
  });

  it('returns consistent capacity and precise scheduler metrics in health response', async () => {
    const server = await createRemoteRunnerServer({
      token: 'dev-token',
      workspaceId: 'default',
      port: 0,
    });
    try {
      const headers = {
        Authorization: 'Bearer dev-token',
        'Content-Type': 'application/json',
        'X-YClaw-Workspace': 'default',
        'X-YClaw-Actor': 'test',
      };

      const created = await fetch(`${server.url}/v1/tasks`, {
        method: 'POST',
        headers: {
          ...headers,
        },
        body: JSON.stringify({
          name: 'Remote health task',
          tags: [],
          flow: {
            id: 'health-flow',
            name: 'Remote health task',
            steps: [],
            createdAt: '2026-04-20T00:00:00.000Z',
            updatedAt: '2026-04-20T00:00:00.000Z',
          },
        }),
      }).then((res) => res.json());

      await fetch(`${server.url}/v1/executions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: created.task.id,
          revisionId: created.revision.revisionId,
        }),
      }).then((res) => res.json());

      const [info, health] = await Promise.all([
        fetch(`${server.url}/v1/runner/info`, { headers }).then((res) => res.json()),
        fetch(`${server.url}/v1/runner/health`, { headers }).then((res) => res.json()),
      ]);

      expect(health.queuedCount).toBe(1);
      expect(health.runningCount).toBe(0);
      expect(health.metrics.runningCount).toBe(0);
      expect(health.metrics).toMatchObject({
        maxConcurrency: info.limits.maxConcurrency,
        cpuUsage: 0,
        memoryUsage: 0,
        heartbeatLatencyMs: 0,
        recentFailureRate: 0,
      });
    } finally {
      await server.close();
    }
  });

  it('calculates recentFailureRate from the latest terminal execution window', () => {
    const runtime = new InMemoryRemoteRunnerRuntime();
    const task = runtime.createTask(
      {
        name: 'Failure rate task',
        tags: [],
        flow: {
          id: 'failure-rate-flow',
          name: 'Failure rate task',
          steps: [],
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      },
      'actor',
    );

    const createExecution = (status: 'queued' | 'failed' | 'timeout' | 'canceled') => {
      const execution = runtime.startExecution(
        {
          taskId: task.task.id,
          revisionId: task.revision.revisionId,
        },
        'actor',
        'runner-1',
      );

      if (status === 'queued') {
        return;
      }

      const mutableExecution = runtime.getExecution(execution.id);
      mutableExecution.status = status;
      mutableExecution.finishedAt = new Date().toISOString();
      mutableExecution.updatedAt = new Date().toISOString();
    };

    for (let index = 0; index < 5; index += 1) {
      createExecution('failed');
    }
    for (let index = 0; index < 5; index += 1) {
      createExecution('timeout');
    }
    for (let index = 0; index < 10; index += 1) {
      createExecution('canceled');
    }
    for (let index = 0; index < 5; index += 1) {
      createExecution('queued');
    }

    expect(runtime.getMetrics().recentFailureRate).toBe(0.5);
  });

  it('orders recentFailureRate samples by terminal time instead of creation order', () => {
    const runtime = new InMemoryRemoteRunnerRuntime();
    const task = runtime.createTask(
      {
        name: 'Terminal order task',
        tags: [],
        flow: {
          id: 'terminal-order-flow',
          name: 'Terminal order task',
          steps: [],
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      },
      'actor',
    );

    const createTerminalExecution = (
      status: 'failed' | 'timeout' | 'canceled',
      finishedAt: string,
      updatedAt: string = finishedAt,
    ) => {
      const execution = runtime.startExecution(
        {
          taskId: task.task.id,
          revisionId: task.revision.revisionId,
        },
        'actor',
        'runner-1',
      );

      const mutableExecution = runtime.getExecution(execution.id);
      mutableExecution.status = status;
      mutableExecution.finishedAt = finishedAt;
      mutableExecution.updatedAt = updatedAt;
    };

    createTerminalExecution('failed', '2026-04-20T00:00:30.000Z');
    for (let index = 0; index < 20; index += 1) {
      const second = String(index + 1).padStart(2, '0');
      createTerminalExecution('canceled', `2026-04-20T00:00:${second}.000Z`);
    }

    expect(runtime.getMetrics().recentFailureRate).toBe(1 / 20);
  });

  it('rejects oversized request bodies with 413 to mitigate DoS', async () => {
    const server = await createRemoteRunnerServer({
      token: 'secret',
      workspaceId: 'default',
      port: 0,
    });
    servers.push(server);

    const oversizedBody = JSON.stringify({ blob: 'x'.repeat(2 * 1024 * 1024) });
    const response = await fetch(`${server.url}/v1/tasks`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret',
        'Content-Type': 'application/json',
        'X-YClaw-Workspace': 'default',
        'X-YClaw-Actor': 'test',
      },
      body: oversizedBody,
    });

    expect(response.status).toBe(413);
    const payload = await response.json();
    expect(payload.error.code).toBe('payload_too_large');
  });
});
