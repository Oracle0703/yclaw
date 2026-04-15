import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
};

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDb),
  },
}));

import { SessionRegistry } from '@main/services/SessionRegistry';

describe('SessionRegistry', () => {
  let service: SessionRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionRegistry();
  });

  it('creates a persistent session container', () => {
    const session = service.createSession('淘宝-账号A', 'taobao.com');

    expect(session.partition).toMatch(/^persist:session_/);
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('lists existing sessions', () => {
    mockDb.all.mockReturnValueOnce([
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
  });

  it('binds a task to a session container', () => {
    service.bindTaskSession('task-1', 'session-1');

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks'),
      ['session-1', 'task-1'],
    );
  });
});
