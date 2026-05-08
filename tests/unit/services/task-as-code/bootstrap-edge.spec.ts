import { describe, expect, it, vi } from 'vitest';
import { bootstrapTaskAsCode } from '@main/services/task-as-code/bootstrap';
import { TAC_CHANNELS, type IpcLikeController } from '@main/ipc/task-as-code-handlers';
import type { TaskRepositoryLike, TemplateRepositoryLike } from '@main/services/task-as-code/RepositoryPersistence';

const noopTask: TaskRepositoryLike = { saveTaskFlow: () => undefined, getTaskCreatedAt: () => null };
const noopTpl: TemplateRepositoryLike = { saveTemplate: (t) => t, getTemplateCreatedAt: () => null };

function ctrl() {
  const handlers = new Map<string, (...a: unknown[]) => unknown>();
  return {
    handlers,
    controller: { handle: (c, h) => { handlers.set(c, h); }, removeHandler: (c) => { handlers.delete(c); } } as IpcLikeController,
  };
}

describe('main · services · task-as-code · bootstrap edge cases', () => {
  it('importYaml rejects when payload.path is not a string', async () => {
    const c = ctrl();
    bootstrapTaskAsCode({ ipcController: c.controller, taskRepository: noopTask, templateRepository: noopTpl, broadcast: vi.fn() });
    const h = c.handlers.get(TAC_CHANNELS.importYaml)!;
    await expect(h({ path: 123 })).rejects.toThrow(/path.*non-empty string/);
    await expect(h({})).rejects.toThrow(/path.*non-empty string/);
    await expect(h({ path: '' })).rejects.toThrow(/path.*non-empty string/);
  });

  it('exportYaml rejects unknown kind', async () => {
    const c = ctrl();
    bootstrapTaskAsCode({ ipcController: c.controller, taskRepository: noopTask, templateRepository: noopTpl, broadcast: vi.fn() });
    const h = c.handlers.get(TAC_CHANNELS.exportYaml)!;
    await expect(h({ kind: 'unknown', payload: {} })).rejects.toThrow();
  });

  it('watchStop on unknown id resolves with stopped:false', async () => {
    const c = ctrl();
    bootstrapTaskAsCode({ ipcController: c.controller, taskRepository: noopTask, templateRepository: noopTpl, broadcast: vi.fn() });
    const h = c.handlers.get(TAC_CHANNELS.watchStop)!;
    await expect(h({ watchId: 'nope' })).resolves.toEqual({ stopped: false });
  });

  it('two bootstraps share the controller — second registration overrides first (last writer wins)', () => {
    const c = ctrl();
    bootstrapTaskAsCode({ ipcController: c.controller, taskRepository: noopTask, templateRepository: noopTpl, broadcast: vi.fn() });
    const firstHandler = c.handlers.get(TAC_CHANNELS.importYaml);
    bootstrapTaskAsCode({ ipcController: c.controller, taskRepository: noopTask, templateRepository: noopTpl, broadcast: vi.fn() });
    const secondHandler = c.handlers.get(TAC_CHANNELS.importYaml);
    expect(secondHandler).toBeDefined();
    expect(secondHandler).not.toBe(firstHandler);
  });

  it('dispose does not call removeHandler for watchEvent (push-only channel)', async () => {
    const removed: string[] = [];
    const controller: IpcLikeController = {
      handle: () => undefined,
      removeHandler: (ch) => { removed.push(ch); },
    };
    const b = bootstrapTaskAsCode({ ipcController: controller, taskRepository: noopTask, templateRepository: noopTpl, broadcast: vi.fn() });
    await b.dispose();
    expect(removed).not.toContain(TAC_CHANNELS.watchEvent);
    expect(removed).toEqual(expect.arrayContaining([
      TAC_CHANNELS.importYaml, TAC_CHANNELS.exportYaml, TAC_CHANNELS.watchStart, TAC_CHANNELS.watchStop,
    ]));
  });
});
