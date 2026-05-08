import type { RunnerConnection } from '@shared/types';

interface RemoteRunnerRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface RunnerConnectionRow {
  id: string;
  name: string;
  base_url: string;
  auth_type: 'token';
  token_ref: string;
  workspace_id: string;
  tls_mode: RunnerConnection['tlsMode'];
  proxy_url: string | null;
  status: RunnerConnection['status'];
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export class RemoteRunnerRepository {
  constructor(private readonly executor: RemoteRunnerRepositoryExecutor) {}

  list(): RunnerConnection[] {
    return this.executor
      .all<RunnerConnectionRow>(
        `SELECT
           id,
           name,
           base_url,
           auth_type,
           token_ref,
           workspace_id,
           tls_mode,
           proxy_url,
           status,
           last_seen_at,
           created_at,
           updated_at
         FROM remote_runner_connections
         ORDER BY updated_at DESC`,
      )
      .map(mapRow);
  }

  get(id: string): RunnerConnection | null {
    const row = this.executor.get<RunnerConnectionRow>(
      `SELECT
         id,
         name,
         base_url,
         auth_type,
         token_ref,
         workspace_id,
         tls_mode,
         proxy_url,
         status,
         last_seen_at,
         created_at,
         updated_at
       FROM remote_runner_connections
       WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  save(connection: RunnerConnection): RunnerConnection {
    this.executor.run(
      `INSERT INTO remote_runner_connections
        (
          id,
          name,
          base_url,
          auth_type,
          token_ref,
          workspace_id,
          tls_mode,
          proxy_url,
          status,
          last_seen_at,
          created_at,
          updated_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         base_url = excluded.base_url,
         auth_type = excluded.auth_type,
         token_ref = excluded.token_ref,
         workspace_id = excluded.workspace_id,
         tls_mode = excluded.tls_mode,
         proxy_url = excluded.proxy_url,
         status = excluded.status,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
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

    return connection;
  }

  delete(id: string): void {
    this.executor.run('DELETE FROM remote_runner_connections WHERE id = ?', [id]);
  }
}

function mapRow(row: RunnerConnectionRow): RunnerConnection {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    authType: row.auth_type,
    tokenRef: row.token_ref,
    workspaceId: row.workspace_id,
    tlsMode: row.tls_mode,
    proxyUrl: row.proxy_url,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
