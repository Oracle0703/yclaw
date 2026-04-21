import type { DataWebhookTarget } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface DataWebhookTargetRow {
  id: string;
  name: string;
  url: string;
  headers_json?: string | null;
  secret_hash?: string | null;
  enabled: number;
  timeout_ms: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

export class DataWebhookTargetRepository {
  constructor(private readonly executor: Executor) {}

  listTargets(): DataWebhookTarget[] {
    return this.executor
      .all<DataWebhookTargetRow>(
        `SELECT id, name, url, headers_json, secret_hash, enabled,
                timeout_ms, max_retries, created_at, updated_at
         FROM data_webhook_targets
         ORDER BY updated_at DESC`,
      )
      .map(mapWebhookTargetRow);
  }

  saveTarget(target: DataWebhookTarget): void {
    this.executor.run(
      `INSERT OR REPLACE INTO data_webhook_targets (
        id, name, url, headers_json, secret_hash, enabled, timeout_ms,
        max_retries, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        target.id,
        target.name,
        target.url,
        target.headers ? JSON.stringify(target.headers) : null,
        target.secretHash ?? null,
        target.enabled ? 1 : 0,
        target.timeoutMs,
        target.maxRetries,
        target.createdAt,
        target.updatedAt,
      ],
    );
  }

  deleteTarget(targetId: string): boolean {
    const result = this.executor.run('DELETE FROM data_webhook_targets WHERE id = ?', [targetId]);
    return Number(result.changes ?? 0) > 0;
  }
}

function mapWebhookTargetRow(row: DataWebhookTargetRow): DataWebhookTarget {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    headers: row.headers_json ? parseJson(row.headers_json, {}) : null,
    secretHash: row.secret_hash ?? null,
    enabled: row.enabled === 1,
    timeoutMs: row.timeout_ms,
    maxRetries: row.max_retries,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
