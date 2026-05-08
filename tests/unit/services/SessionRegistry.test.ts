import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSessionRepository = {
  createSession: vi.fn(),
  listSessions: vi.fn(),
  bindTaskSession: vi.fn(),
  deleteSession: vi.fn(),
};

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      run: vi.fn(),
      all: vi.fn(),
    })),
  },
}));

import { SessionRegistry } from '@main/services/SessionRegistry';

describe('SessionRegistry', () => {
  let service: SessionRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionRegistry({
      sessionRepository: mockSessionRepository,
    } as never);
  });

  it('requires session repository injection', () => {
    expect(() => new SessionRegistry()).toThrow('sessionRepository is required');
  });

  it('creates a persistent session container', () => {
    mockSessionRepository.createSession.mockImplementationOnce((session) => session);

    const session = service.createSession('淘宝-账号A', 'taobao.com');

    expect(session.partition).toMatch(/^persist:session_/);
    expect(mockSessionRepository.createSession).toHaveBeenCalledTimes(1);
  });

  it('lists existing sessions', () => {
    mockSessionRepository.listSessions.mockReturnValueOnce([
      {
        id: 'session-1',
        name: '淘宝-账号A',
        domain: 'taobao.com',
        partition: 'persist:session_1',
        created_at: '2026-04-15T00:00:00.000Z',
        updated_at: '2026-04-15T00:00:00.000Z',
      },
    ]);

    const sessions = service.listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].partition).toBe('persist:session_1');
    expect(mockSessionRepository.listSessions).toHaveBeenCalledTimes(1);
  });

  it('binds a task to a session container', () => {
    service.bindTaskSession('task-1', 'session-1');

    expect(mockSessionRepository.bindTaskSession).toHaveBeenCalledWith('task-1', 'session-1');
  });
});
