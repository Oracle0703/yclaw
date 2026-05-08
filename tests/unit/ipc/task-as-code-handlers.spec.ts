import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskAsCodeService } from '@shared/serialization/service';
import {
  createTaskAsCodeHandlers,
  registerTaskAsCodeHandlers,
  TAC_CHANNELS,
  type IpcLikeController,
  type WatchEventEnvelope,
} from '@main/ipc/task-as-code-handlers';

const TASK_YAML = [
  'schemaVersion: 1',
  'kind: Task',
  'metadata:',
  '  id: t1',
  '  name: t',
  'spec:',
  '  steps:',
  "    - id: s1",
  '      name: c',
  "      action: { type: click, selector: '#a' }",
  '',
].join('\n');

function svc(): TaskAsCodeService {
  return new TaskAsCodeService(
    { upsertTask: () => undefined, upsertTemplate: () => undefined },
    { now: () => 1_700_000_000_000 },
  );
}

describe('main · ipc · task-as-code-handlers', () => {
  let tmp = '';
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tac-ipc-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('importYaml delegates to service.importPath and returns aggregate', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML, 'utf8');
    const h = createTaskAsCodeHandlers({ service: svc(), emit: vi.fn() });
    const res = (await h.importYaml({ path: file })) as { taskCount: number };
    expect(res.taskCount).toBe(1);
  });

  it('importYaml rejects empty path with explicit error', async () => {
    const h = createTaskAsCodeHandlers({ service: svc(), emit: vi.fn() });
    await expect(h.importYaml({ path: '' })).rejects.toThrow(/non-empty string/);
    await expect(h.importYaml({})).rejects.toThrow(/non-empty string/);
    await expect(h.importYaml(undefined)).rejects.toThrow(/non-empty string/);
  });

  it('exportYaml routes by kind=task', async () => {
    const h = createTaskAsCodeHandlers({ service: svc(), emit: vi.fn() });
    const res = (await h.exportYaml({
      kind: 'task',
      payload: {
        id: 'x', name: 'n',
        steps: [{ id: 's', name: 'c', action: { type: 'click', selector: '#a' } }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })) as { yaml: string };
    expect(res.yaml).toMatch(/kind: Task/);
  });

  it('exportYaml rejects unknown kind', async () => {
    const h = createTaskAsCodeHandlers({ service: svc(), emit: vi.fn() });
    await expect(h.exportYaml({ kind: 'session', payload: {} })).rejects.toThrow(/Unknown kind/);
  });

  it('watchStart/Stop manages lifecycle and emits events through emit()', async () => {
    const emit = vi.fn();
    const fakeStop = vi.fn(async () => undefined);
    let captured: ((e: import('@shared/serialization/service').AffectedEvent) => void) | null = null;
    const fakeService = {
      watchDirectory: vi.fn(async (_root: string, cb: typeof captured) => {
        captured = cb;
        return { initialFileCount: 3, stop: fakeStop };
      }),
    } as unknown as TaskAsCodeService;
    const h = createTaskAsCodeHandlers({
      service: fakeService,
      emit,
      generateId: () => 'w1',
    });
    const start = (await h.watchStart({ rootDir: tmp, debounceMs: 10 })) as {
      watchId: string; initialFileCount: number;
    };
    expect(start).toEqual({ watchId: 'w1', initialFileCount: 3 });

    captured!({ at: 1, tasks: ['t1'], templates: [], removedPaths: [] });
    expect(emit).toHaveBeenCalledWith(TAC_CHANNELS.watchEvent, {
      watchId: 'w1',
      event: { at: 1, tasks: ['t1'], templates: [], removedPaths: [] },
    } satisfies WatchEventEnvelope);

    const stopped = (await h.watchStop({ watchId: 'w1' })) as { stopped: boolean };
    expect(stopped).toEqual({ stopped: true });
    expect(fakeStop).toHaveBeenCalledTimes(1);

    const again = (await h.watchStop({ watchId: 'w1' })) as { stopped: boolean };
    expect(again).toEqual({ stopped: false });
  });

  it('disposeAll stops all live watches', async () => {
    const stopA = vi.fn(async () => undefined);
    const stopB = vi.fn(async () => undefined);
    let nth = 0;
    const fakeService = {
      watchDirectory: vi.fn(async () => {
        nth += 1;
        return { initialFileCount: 0, stop: nth === 1 ? stopA : stopB };
      }),
    } as unknown as TaskAsCodeService;
    let id = 0;
    const h = createTaskAsCodeHandlers({
      service: fakeService,
      emit: vi.fn(),
      generateId: () => `w${++id}`,
    });
    await h.watchStart({ rootDir: tmp });
    await h.watchStart({ rootDir: tmp });
    await h.disposeAll();
    expect(stopA).toHaveBeenCalled();
    expect(stopB).toHaveBeenCalled();
    expect(h.watchCount).toBe(0);
    expect(h.listWatchIds()).toEqual([]);
  });

  it('registerTaskAsCodeHandlers binds the 4 channels', () => {
    const calls: string[] = [];
    const ctrl: IpcLikeController = { handle: (c) => { calls.push(c); } };
    const h = createTaskAsCodeHandlers({ service: svc(), emit: vi.fn() });
    registerTaskAsCodeHandlers(ctrl, h);
    expect(calls.sort()).toEqual([
      TAC_CHANNELS.exportYaml,
      TAC_CHANNELS.importYaml,
      TAC_CHANNELS.watchStart,
      TAC_CHANNELS.watchStop,
    ].sort());
  });

  it('watchStart rejects when maxWatches reached', async () => {
    const fakeService = {
      watchDirectory: vi.fn(async () => ({ initialFileCount: 0, stop: async () => undefined })),
    } as unknown as TaskAsCodeService;
    let id = 0;
    const h = createTaskAsCodeHandlers({
      service: fakeService,
      emit: vi.fn(),
      generateId: () => `w${++id}`,
      maxWatches: 2,
    });
    await h.watchStart({ rootDir: tmp });
    await h.watchStart({ rootDir: tmp });
    await expect(h.watchStart({ rootDir: tmp })).rejects.toThrow(/Watch limit reached/);
    await h.disposeAll();
  });

  it('TTL fires auto-stop and frees slot for new watch', async () => {
    const stops: Array<() => Promise<void>> = [];
    const fakeService = {
      watchDirectory: vi.fn(async () => {
        const stop = vi.fn(async () => undefined);
        stops.push(stop);
        return { initialFileCount: 0, stop };
      }),
    } as unknown as TaskAsCodeService;
    // 注入定时器：保留 cb，手动触发。
    let timerCb: (() => void) | null = null;
    const setTimer = vi.fn((cb: () => void, _ms: number) => { timerCb = cb; return { token: 1 }; });
    const clearTimer = vi.fn();
    let id = 0;
    const h = createTaskAsCodeHandlers({
      service: fakeService,
      emit: vi.fn(),
      generateId: () => `w${++id}`,
      maxWatches: 1,
      watchTtlMs: 1000,
      setTimer,
      clearTimer,
    });
    await h.watchStart({ rootDir: tmp });
    expect(setTimer).toHaveBeenCalledOnce();
    expect(h.watchCount).toBe(1);
    // 触发 TTL：应自动停止并释放槽位。
    timerCb!();
    await new Promise((r) => setImmediate(r));
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(h.watchCount).toBe(0);
    // 槽位释放后可再次 start。
    await expect(h.watchStart({ rootDir: tmp })).resolves.toMatchObject({ watchId: 'w2' });
    await h.disposeAll();
  });

  it('watchStop clears TTL timer to avoid double-stop', async () => {
    const stop = vi.fn(async () => undefined);
    const fakeService = {
      watchDirectory: vi.fn(async () => ({ initialFileCount: 0, stop })),
    } as unknown as TaskAsCodeService;
    const setTimer = vi.fn(() => ({ token: 'a' }));
    const clearTimer = vi.fn();
    const h = createTaskAsCodeHandlers({
      service: fakeService,
      emit: vi.fn(),
      generateId: () => 'w1',
      watchTtlMs: 1000,
      setTimer,
      clearTimer,
    });
    await h.watchStart({ rootDir: tmp });
    await h.watchStop({ watchId: 'w1' });
    expect(clearTimer).toHaveBeenCalledWith({ token: 'a' });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('watchTtlMs=0 disables TTL timer', async () => {
    const fakeService = {
      watchDirectory: vi.fn(async () => ({ initialFileCount: 0, stop: async () => undefined })),
    } as unknown as TaskAsCodeService;
    const setTimer = vi.fn();
    const h = createTaskAsCodeHandlers({
      service: fakeService,
      emit: vi.fn(),
      generateId: () => 'w1',
      watchTtlMs: 0,
      setTimer,
    });
    await h.watchStart({ rootDir: tmp });
    expect(setTimer).not.toHaveBeenCalled();
    await h.disposeAll();
  });

  it('disposeAll clears every live TTL timer', async () => {
    const fakeService = {
      watchDirectory: vi.fn(async () => ({ initialFileCount: 0, stop: async () => undefined })),
    } as unknown as TaskAsCodeService;
    let n = 0;
    const setTimer = vi.fn(() => ({ id: ++n }));
    const clearTimer = vi.fn();
    let id = 0;
    const h = createTaskAsCodeHandlers({
      service: fakeService,
      emit: vi.fn(),
      generateId: () => `w${++id}`,
      watchTtlMs: 1000,
      setTimer,
      clearTimer,
    });
    await h.watchStart({ rootDir: tmp });
    await h.watchStart({ rootDir: tmp });
    await h.watchStart({ rootDir: tmp });
    expect(setTimer).toHaveBeenCalledTimes(3);
    await h.disposeAll();
    expect(clearTimer).toHaveBeenCalledTimes(3);
    expect(h.watchCount).toBe(0);
  });
});
