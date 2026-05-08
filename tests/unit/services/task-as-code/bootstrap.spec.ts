import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapTaskAsCode } from '@main/services/task-as-code/bootstrap';
import { TAC_CHANNELS, type IpcLikeController } from '@main/ipc/task-as-code-handlers';
import type { TaskRepositoryLike, TemplateRepositoryLike } from '@main/services/task-as-code/RepositoryPersistence';

function makeCtrl() {
  const handlers = new Map<string, (...a: unknown[]) => unknown>();
  const ctrl: IpcLikeController = {
    handle: (ch, h) => { handlers.set(ch, h); },
    removeHandler: (ch) => { handlers.delete(ch); },
  };
  return { ctrl, handlers };
}

const noopTask: TaskRepositoryLike = {
  saveTaskFlow: () => undefined,
  getTaskCreatedAt: () => null,
};
const noopTpl: TemplateRepositoryLike = {
  saveTemplate: (t) => t,
  getTemplateCreatedAt: () => null,
};

describe('main · services · task-as-code · bootstrap', () => {
  it('registers all four channels on the IPC controller', () => {
    const { ctrl, handlers } = makeCtrl();
    bootstrapTaskAsCode({
      ipcController: ctrl,
      taskRepository: noopTask,
      templateRepository: noopTpl,
      broadcast: () => undefined,
    });
    expect(handlers.has(TAC_CHANNELS.importYaml)).toBe(true);
    expect(handlers.has(TAC_CHANNELS.exportYaml)).toBe(true);
    expect(handlers.has(TAC_CHANNELS.watchStart)).toBe(true);
    expect(handlers.has(TAC_CHANNELS.watchStop)).toBe(true);
  });

  it('dispose removes all four registered channels', async () => {
    const { ctrl, handlers } = makeCtrl();
    const b = bootstrapTaskAsCode({
      ipcController: ctrl, taskRepository: noopTask, templateRepository: noopTpl,
      broadcast: () => undefined,
    });
    expect(handlers.size).toBe(4);
    await b.dispose();
    expect(handlers.size).toBe(0);
  });

  it('dispose is idempotent', async () => {
    const { ctrl } = makeCtrl();
    const b = bootstrapTaskAsCode({
      ipcController: ctrl, taskRepository: noopTask, templateRepository: noopTpl,
      broadcast: () => undefined,
    });
    await b.dispose();
    await expect(b.dispose()).resolves.toBeUndefined();
  });

  it('importYaml handler routes through service to repository', async () => {
    const { ctrl, handlers } = makeCtrl();
    const tmp = mkdtempSync(join(tmpdir(), 'tac-bootstrap-'));
    try {
      const file = join(tmp, 'a.yaml');
      writeFileSync(file, [
        'schemaVersion: 1', 'kind: Task',
        'metadata: { id: t1, name: t }',
        'spec:',
        '  steps:',
        "    - { id: s1, name: c, action: { type: click, selector: '#a' } }",
        '',
      ].join('\n'), 'utf8');

      const saved: string[] = [];
      const taskRepo: TaskRepositoryLike = {
        saveTaskFlow: (f) => { saved.push(f.id); },
        getTaskCreatedAt: () => null,
      };
      bootstrapTaskAsCode({
        ipcController: ctrl, taskRepository: taskRepo, templateRepository: noopTpl,
        broadcast: () => undefined,
      });
      const importHandler = handlers.get(TAC_CHANNELS.importYaml)!;
      const result = (await importHandler({ path: file })) as { taskCount: number };
      expect(result.taskCount).toBe(1);
      expect(saved).toEqual(['t1']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('controller without removeHandler still disposes watchers without throwing', async () => {
    const handlers = new Map<string, (...a: unknown[]) => unknown>();
    const ctrl: IpcLikeController = { handle: (ch, h) => { handlers.set(ch, h); } };
    const b = bootstrapTaskAsCode({
      ipcController: ctrl, taskRepository: noopTask, templateRepository: noopTpl,
      broadcast: () => undefined,
    });
    await expect(b.dispose()).resolves.toBeUndefined();
  });

  it('watchStart returns a string watchId and exposes it via handlers.listWatchIds', async () => {
    const { ctrl, handlers } = makeCtrl();
    const tmp = mkdtempSync(join(tmpdir(), 'tac-bootstrap-watch-'));
    const b = bootstrapTaskAsCode({
      ipcController: ctrl, taskRepository: noopTask, templateRepository: noopTpl,
      broadcast: vi.fn(),
    });
    try {
      const startHandler = handlers.get(TAC_CHANNELS.watchStart)!;
      const { watchId } = (await startHandler({ rootDir: tmp, debounceMs: 5 })) as { watchId: string };
      expect(typeof watchId).toBe('string');
      expect(b.handlers.listWatchIds()).toContain(watchId);
    } finally {
      await b.dispose();
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
