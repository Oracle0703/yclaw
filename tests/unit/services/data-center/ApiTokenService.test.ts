import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

import { ApiTokenService } from '@main/services/data-center/ApiTokenService';

describe('ApiTokenService', () => {
  it('creates a plaintext token and stores only its hash', () => {
    const repository = {
      listTokens: vi.fn(() => []),
      saveToken: vi.fn(),
    };
    const service = new ApiTokenService({
      repository,
      now: () => new Date('2026-04-22T00:00:00.000Z'),
      createId: () => 'token-1',
      createSecret: () => 'plain-token-secret',
    });

    const issued = service.issueToken({
      name: '只读 Token',
      scopes: ['results:read', 'datasets:read'],
    });

    expect(issued.plainTextToken).toBe('plain-token-secret');
    expect(issued.token.id).toBe('token-1');
    expect(issued.token.tokenHash).toBe(createHash('sha256').update('plain-token-secret').digest('hex'));
    expect(repository.saveToken).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'token-1',
        enabled: true,
      }),
    );
  });

  it('revokes an existing token and stores revoked timestamp', () => {
    const repository = {
      listTokens: vi.fn(() => [
        {
          id: 'token-1',
          name: '只读 Token',
          tokenHash: 'hash',
          scopes: ['results:read'],
          enabled: true,
          lastUsedAt: null,
          createdAt: '2026-04-22T00:00:00.000Z',
          revokedAt: null,
        },
      ]),
      saveToken: vi.fn(),
    };
    const service = new ApiTokenService({
      repository,
      now: () => new Date('2026-04-22T01:00:00.000Z'),
    });

    const revoked = service.revokeToken('token-1');

    expect(revoked?.enabled).toBe(false);
    expect(revoked?.revokedAt).toBe('2026-04-22T01:00:00.000Z');
    expect(repository.saveToken).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'token-1',
        enabled: false,
      }),
    );
  });
});
