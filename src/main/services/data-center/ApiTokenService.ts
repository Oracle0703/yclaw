import { createHash, randomBytes, randomUUID } from 'crypto';
import type { DataApiToken } from '@shared/types';
import type { DataApiTokenRepository } from '../repositories/DataApiTokenRepository';

interface ApiTokenServiceOptions {
  repository: Pick<DataApiTokenRepository, 'listTokens' | 'saveToken'>;
  now?: () => Date;
  createId?: () => string;
  createSecret?: () => string;
}

interface IssueTokenInput {
  name: string;
  scopes: string[];
}

interface IssuedToken {
  token: DataApiToken;
  plainTextToken: string;
}

export class ApiTokenService {
  private readonly repository: Pick<DataApiTokenRepository, 'listTokens' | 'saveToken'>;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createSecret: () => string;

  constructor(options: ApiTokenServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
    this.createSecret = options.createSecret ?? (() => randomBytes(24).toString('hex'));
  }

  listTokens(): DataApiToken[] {
    return this.repository.listTokens();
  }

  issueToken(input: IssueTokenInput): IssuedToken {
    const plainTextToken = this.createSecret();
    const createdAt = this.now().toISOString();
    const token: DataApiToken = {
      id: this.createId(),
      name: input.name,
      tokenHash: createHash('sha256').update(plainTextToken).digest('hex'),
      scopes: input.scopes,
      enabled: true,
      lastUsedAt: null,
      createdAt,
      revokedAt: null,
    };

    this.repository.saveToken(token);
    return { token, plainTextToken };
  }

  revokeToken(tokenId: string): DataApiToken | null {
    const token = this.repository.listTokens().find((item) => item.id === tokenId);
    if (!token) {
      return null;
    }

    const revokedToken: DataApiToken = {
      ...token,
      enabled: false,
      revokedAt: this.now().toISOString(),
    };
    this.repository.saveToken(revokedToken);
    return revokedToken;
  }
}
