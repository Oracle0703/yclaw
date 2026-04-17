import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserSession } from '@shared/types';
import { SessionRepository } from '@main/services/repositories/SessionRepository';

function createExecutor() {
  return {
    all: vi.fn(),
    run: vi.fn(),
  };
}

describe('SessionRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: SessionRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new SessionRepository(executor);
  });

  it('persists a browser session record', () => {
    const session: BrowserSession = {
      id: 'session-1',
      name: '淘宝-A',
      domain: 'taobao.com',
      partition: 'persist:session_1',
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
    };

    repository.createSession(session);

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions'),
      [session.id, session.name, session.domain, session.partition, session.createdAt, session.updatedAt],
    );
  });

  it('maps session rows to browser sessions', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'session-1',
        name: '淘宝-A',
        domain: 'taobao.com',
        partition: 'persist:session_1',
        created_at: '2026-04-17T00:00:00.000Z',
        updated_at: '2026-04-17T00:00:00.000Z',
      },
    ]);

    expect(repository.listSessions()).toEqual([
      {
        id: 'session-1',
        name: '淘宝-A',
        domain: 'taobao.com',
        partition: 'persist:session_1',
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
    ]);
  });

  it('binds and deletes sessions by id', () => {
    repository.bindTaskSession('task-1', 'session-1');
    repository.deleteSession('session-1');

    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE tasks'),
      ['session-1', 'task-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(2, 'DELETE FROM sessions WHERE id = ?', ['session-1']);
  });
});
