import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

import { WebhookTargetService } from '@main/services/data-center/WebhookTargetService';

describe('WebhookTargetService', () => {
  it('hashes secret and saves webhook target with timestamps', () => {
    const repository = {
      listTargets: vi.fn(() => []),
      saveTarget: vi.fn(),
    };
    const service = new WebhookTargetService({
      repository,
      now: () => new Date('2026-04-22T00:00:00.000Z'),
    });

    const target = service.saveTarget({
      id: 'webhook-1',
      name: '运营回调',
      url: 'http://127.0.0.1:3000/hook',
      headers: { 'x-env': 'dev' },
      secret: 'hook-secret',
      enabled: true,
      timeoutMs: 5000,
      maxRetries: 2,
    });

    expect(target.secretHash).toBe(createHash('sha256').update('hook-secret').digest('hex'));
    expect(repository.saveTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'webhook-1',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      }),
    );
  });

  it('tests webhook connectivity through delivery service', async () => {
    const repository = {
      listTargets: vi.fn(() => []),
      saveTarget: vi.fn(),
    };
    const deliveryService = {
      deliver: vi.fn(async () => ({ status: 'succeeded', attempts: 1, responseSummary: 'HTTP 200' })),
    };
    const service = new WebhookTargetService({
      repository,
      deliveryService,
      now: () => new Date('2026-04-22T00:00:00.000Z'),
    });

    const result = await service.testTarget({
      id: 'webhook-1',
      name: '运营回调',
      url: 'http://127.0.0.1:3000/hook',
      headers: { 'x-env': 'dev' },
      secret: 'hook-secret',
      enabled: true,
      timeoutMs: 5000,
      maxRetries: 2,
    });

    expect(result.status).toBe('succeeded');
    expect(deliveryService.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://127.0.0.1:3000/hook',
        secret: 'hook-secret',
      }),
    );
  });

  it('deletes webhook target by id', () => {
    const repository = {
      listTargets: vi.fn(() => []),
      saveTarget: vi.fn(),
      deleteTarget: vi.fn(() => true),
    };
    const service = new WebhookTargetService({
      repository,
      now: () => new Date('2026-04-22T00:00:00.000Z'),
    });

    expect(service.deleteTarget('webhook-1')).toBe(true);
    expect(repository.deleteTarget).toHaveBeenCalledWith('webhook-1');
  });
});
