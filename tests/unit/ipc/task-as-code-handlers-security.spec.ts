import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTaskAsCodeHandlers,
  TAC_CHANNELS,
} from '@main/ipc/task-as-code-handlers';
import type { TaskAsCodeService } from '@shared/serialization/service';

function fakeService(overrides: Partial<TaskAsCodeService> = {}): TaskAsCodeService {
  return {
    importPath: vi.fn(async () => ({ taskCount: 0, templateCount: 0, issues: [] })),
    exportTask: vi.fn(() => ({ yaml: '' })),
    exportTemplate: vi.fn(() => ({ yaml: '' })),
    watchDirectory: vi.fn(async () => ({ initialFileCount: 0, stop: async () => undefined })),
    ...overrides,
  } as unknown as TaskAsCodeService;
}

describe('main · ipc · task-as-code-handlers · security/edge-case', () => {
  let disposers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const d of disposers) await d();
    disposers = [];
  });

  it.each([
    [{ path: 123 }],
    [{ path: null }],
    [{ path: { malicious: 1 } }],
    [{ path: ['a'] }],
  ])('importYaml rejects non-string path %j without calling service', async (payload) => {
    const svc = fakeService();
    const h = createTaskAsCodeHandlers({ service: svc, emit: vi.fn() });
    await expect(h.importYaml(payload)).rejects.toThrow(/non-empty string/);
    expect(svc.importPath).not.toHaveBeenCalled();
  });

  it('exportYaml requires kind to be a non-empty string', async () => {
    const h = createTaskAsCodeHandlers({ service: fakeService(), emit: vi.fn() });
    await expect(h.exportYaml({ kind: '', payload: {} })).rejects.toThrow(/non-empty string/);
    await expect(h.exportYaml({ payload: {} })).rejects.toThrow(/non-empty string/);
    await expect(h.exportYaml(null)).rejects.toThrow(/non-empty string/);
  });

  it('watchStart with negative debounceMs is forwarded as-is (caller policy)', async () => {
    const watchDirectory = vi.fn(async () => ({ initialFileCount: 0, stop: async () => undefined }));
    const svc = fakeService({ watchDirectory } as unknown as Partial<TaskAsCodeService>);
    const h = createTaskAsCodeHandlers({ service: svc, emit: vi.fn(), generateId: () => 'w' });
    await h.watchStart({ rootDir: '/x', debounceMs: -1 });
    expect(watchDirectory).toHaveBeenCalledWith('/x', expect.any(Function), { debounceMs: -1 });
  });

  it('watchStart propagates service errors and does not register a watch', async () => {
    const svc = fakeService({
      watchDirectory: vi.fn(async () => { throw new Error('watch boom'); }),
    } as unknown as Partial<TaskAsCodeService>);
    const h = createTaskAsCodeHandlers({ service: svc, emit: vi.fn(), generateId: () => 'w' });
    await expect(h.watchStart({ rootDir: '/x' })).rejects.toThrow(/watch boom/);
    expect(h.watchCount).toBe(0);
  });

  it('watchStart yields unique ids per call', async () => {
    let n = 0;
    const svc = fakeService();
    const h = createTaskAsCodeHandlers({
      service: svc, emit: vi.fn(), generateId: () => `w${++n}`,
    });
    const a = (await h.watchStart({ rootDir: '/x' })) as { watchId: string };
    const b = (await h.watchStart({ rootDir: '/x' })) as { watchId: string };
    expect(a.watchId).not.toBe(b.watchId);
    expect(h.watchCount).toBe(2);
    disposers.push(() => h.disposeAll());
  });

  it('emit on watchStart receives the channel constant exactly', async () => {
    const emit = vi.fn();
    let cb: ((e: import('@shared/serialization/service').AffectedEvent) => void) | null = null;
    const svc = fakeService({
      watchDirectory: vi.fn(async (_r: string, c: typeof cb) => {
        cb = c;
        return { initialFileCount: 0, stop: async () => undefined };
      }),
    } as unknown as Partial<TaskAsCodeService>);
    const h = createTaskAsCodeHandlers({ service: svc, emit, generateId: () => 'w' });
    await h.watchStart({ rootDir: '/x' });
    cb!({ at: 1, tasks: [], templates: [], removedPaths: [] });
    expect(emit).toHaveBeenCalledWith(TAC_CHANNELS.watchEvent, expect.objectContaining({
      watchId: 'w',
    }));
  });

  it('disposeAll tolerates a stop that rejects', async () => {
    let n = 0;
    const svc = fakeService({
      watchDirectory: vi.fn(async () => {
        n += 1;
        return { initialFileCount: 0, stop: n === 1
          ? async () => { throw new Error('nope'); }
          : async () => undefined };
      }),
    } as unknown as Partial<TaskAsCodeService>);
    const h = createTaskAsCodeHandlers({
      service: svc, emit: vi.fn(), generateId: () => `w${n}`,
    });
    await h.watchStart({ rootDir: '/x' });
    await h.watchStart({ rootDir: '/x' });
    await expect(h.disposeAll()).resolves.toBeUndefined();
    expect(h.watchCount).toBe(0);
  });
});
