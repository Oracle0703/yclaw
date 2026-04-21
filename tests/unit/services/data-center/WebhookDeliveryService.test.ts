import { describe, expect, it, vi } from 'vitest';

import { WebhookDeliveryService } from '@main/services/data-center/WebhookDeliveryService';

describe('WebhookDeliveryService', () => {
  it('retries failed delivery and signs the final request', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const auditRepository = { appendAudit: vi.fn() };
    const service = new WebhookDeliveryService({
      fetchImpl,
      auditRepository,
      createId: () => 'audit-id',
      now: () => new Date('2026-04-21T00:00:00.000Z'),
    });

    const result = await service.deliver({
      exportJobId: 'export-1',
      url: 'http://127.0.0.1:3000/hook',
      headers: { 'x-source': 'yclaw' },
      payload: { event: 'export.succeeded' },
      secret: 'secret',
      maxRetries: 2,
    });

    expect(result.status).toBe('succeeded');
    expect(result.attempts).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toEqual(
      expect.objectContaining({
        'content-type': 'application/json',
        'x-source': 'yclaw',
        'x-yclaw-signature': expect.stringMatching(/^sha256=/),
      }),
    );
    expect(auditRepository.appendAudit).toHaveBeenCalledTimes(2);
  });
});
