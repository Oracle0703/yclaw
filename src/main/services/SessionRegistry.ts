import { randomUUID } from 'crypto';
import type { BrowserSession } from '@shared/types';
import type { DatabaseService } from './DatabaseService';
import { DatabaseService as DatabaseServiceSingleton } from './DatabaseService';

export interface SessionRegistryOptions {
  databaseService?: Pick<DatabaseService, 'run' | 'all'>;
}

export class SessionRegistry {
  private readonly databaseService: Pick<DatabaseService, 'run' | 'all'>;

  constructor(options: SessionRegistryOptions = {}) {
    this.databaseService = options.databaseService ?? DatabaseServiceSingleton.getInstance();
  }

  createSession(name: string, domain: string): BrowserSession {
    const session: BrowserSession = {
      id: randomUUID(),
      name,
      domain,
      partition: `persist:session_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.databaseService.run(
      `INSERT INTO sessions (id, name, domain, partition, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session.id, session.name, session.domain, session.partition, session.createdAt, session.updatedAt],
    );

    return session;
  }

  listSessions(): BrowserSession[] {
    const rows = this.databaseService.all<{
      id: string;
      name: string;
      domain: string;
      partition: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, domain, partition, created_at, updated_at
       FROM sessions
       ORDER BY updated_at DESC`,
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      partition: row.partition,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  bindTaskSession(taskId: string, sessionId: string): void {
    this.databaseService.run(
      'UPDATE tasks SET session_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [sessionId, taskId],
    );
  }

  deleteSession(sessionId: string): void {
    this.databaseService.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }
}
