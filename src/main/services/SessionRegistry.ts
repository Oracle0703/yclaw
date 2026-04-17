import { randomUUID } from 'crypto';
import type { BrowserSession } from '@shared/types';
import { SessionRepository } from './repositories';

export interface SessionRegistryOptions {
  sessionRepository?: Pick<
    SessionRepository,
    'createSession' | 'listSessions' | 'bindTaskSession' | 'deleteSession'
  >;
}

export class SessionRegistry {
  private readonly sessionRepository: Pick<
    SessionRepository,
    'createSession' | 'listSessions' | 'bindTaskSession' | 'deleteSession'
  >;

  constructor(options: SessionRegistryOptions = {}) {
    if (!options.sessionRepository) {
      throw new Error('sessionRepository is required');
    }

    this.sessionRepository = options.sessionRepository;
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

    this.sessionRepository.createSession(session);

    return session;
  }

  listSessions(): BrowserSession[] {
    return this.sessionRepository.listSessions();
  }

  bindTaskSession(taskId: string, sessionId: string): void {
    this.sessionRepository.bindTaskSession(taskId, sessionId);
  }

  deleteSession(sessionId: string): void {
    this.sessionRepository.deleteSession(sessionId);
  }
}
