import type { BrowserSession } from '@shared/types';

interface SessionRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface SessionRow {
  id: string;
  name: string;
  domain: string;
  partition: string;
  created_at: string;
  updated_at: string;
}

export class SessionRepository {
  constructor(private readonly executor: SessionRepositoryExecutor) {}

  createSession(session: BrowserSession): void {
    this.executor.run(
      `INSERT INTO sessions (id, name, domain, partition, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.name,
        session.domain,
        session.partition,
        session.createdAt,
        session.updatedAt,
      ],
    );
  }

  listSessions(): BrowserSession[] {
    return this.executor
      .all<SessionRow>(
        `SELECT id, name, domain, partition, created_at, updated_at
         FROM sessions
         ORDER BY updated_at DESC`,
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        partition: row.partition,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  bindTaskSession(taskId: string, sessionId: string): void {
    this.executor.run(
      'UPDATE tasks SET session_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [sessionId, taskId],
    );
  }

  deleteSession(sessionId: string): void {
    this.executor.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }
}
