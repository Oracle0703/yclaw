import { createHash, timingSafeEqual } from 'crypto';
import type { DataApiToken } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
}

interface DataApiTokenRow {
  id: string;
  name: string;
  token_hash: string;
  scopes_json: string;
  enabled: number;
  last_used_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
}

export class DataApiTokenRepository {
  constructor(private readonly executor: Executor) {}

  listTokens(): DataApiToken[] {
    return this.executor
      .all<DataApiTokenRow>(
        `SELECT id, name, token_hash, scopes_json, enabled, last_used_at, created_at, revoked_at
         FROM data_api_tokens
         ORDER BY created_at DESC`,
      )
      .map(mapApiTokenRow);
  }

  saveToken(token: DataApiToken): void {
    this.executor.run(
      `INSERT OR REPLACE INTO data_api_tokens (
        id, name, token_hash, scopes_json, enabled, last_used_at, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        token.id,
        token.name,
        token.tokenHash,
        JSON.stringify(token.scopes),
        token.enabled ? 1 : 0,
        token.lastUsedAt ?? null,
        token.createdAt,
        token.revokedAt ?? null,
      ],
    );
  }

  verifyToken(token: string, requiredScopes: string[]): boolean {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = this.executor.get<DataApiTokenRow>(
      `SELECT id, name, token_hash, scopes_json, enabled, last_used_at, created_at, revoked_at
       FROM data_api_tokens
       WHERE enabled = 1 AND revoked_at IS NULL`,
    );

    if (!row || !safeEqual(row.token_hash, tokenHash)) {
      return false;
    }

    const scopes = parseJson<string[]>(row.scopes_json, []);
    const hasScopes = requiredScopes.every((scope) => scopes.includes(scope));
    if (!hasScopes) {
      return false;
    }

    this.executor.run('UPDATE data_api_tokens SET last_used_at = ? WHERE id = ?', [
      new Date().toISOString(),
      row.id,
    ]);
    return true;
  }
}

function mapApiTokenRow(row: DataApiTokenRow): DataApiToken {
  return {
    id: row.id,
    name: row.name,
    tokenHash: row.token_hash,
    scopes: parseJson(row.scopes_json, []),
    enabled: row.enabled === 1,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? null,
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
