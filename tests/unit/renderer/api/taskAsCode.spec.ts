import { describe, expect, it, vi } from 'vitest';
import { createTaskAsCodeApi } from '@renderer/shared/api/taskAsCode';
import { TAC_CHANNELS } from '@shared/constants';
import type { IpcResponse } from '@shared/types';

function ok<T>(data: T): IpcResponse<T> { return { success: true, data }; }
function err(message: string, code = 'E_TEST'): IpcResponse<never> {
  return { success: false, error: { code, message } };
}

describe('renderer · api · createTaskAsCodeApi', () => {
  it('importYaml unwraps IpcResponse and forwards path on the right channel', async () => {
    const invoke = vi.fn(async (ch: string) => {
      expect(ch).toBe(TAC_CHANNELS.importYaml);
      return ok({ taskCount: 1, templateCount: 0, issues: [] });
    });
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    const r = await api.importYaml('/x.yaml');
    expect(r.taskCount).toBe(1);
    expect(invoke).toHaveBeenCalledWith(TAC_CHANNELS.importYaml, { path: '/x.yaml' });
  });

  it('exportYaml passes kind + payload to channel', async () => {
    const invoke = vi.fn(async () => ok({ yaml: 'k: v\n' }));
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    const flow = { id: 't1', name: 'n', steps: [], createdAt: '', updatedAt: '' } as never;
    const r = await api.exportYaml('task', flow);
    expect(r.yaml).toContain('k:');
    expect(invoke.mock.calls[0]![0]).toBe(TAC_CHANNELS.exportYaml);
    expect((invoke.mock.calls[0]![1] as { kind: string }).kind).toBe('task');
  });

  it('watchStart / watchStop forward args + unwrap', async () => {
    const invoke = vi.fn(async (ch: string) => {
      if (ch === TAC_CHANNELS.watchStart) return ok({ watchId: 'w1', initialFileCount: 3 });
      if (ch === TAC_CHANNELS.watchStop) return ok({ stopped: true });
      throw new Error('unexpected');
    });
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    expect(await api.watchStart('/r', 100)).toEqual({ watchId: 'w1', initialFileCount: 3 });
    expect(invoke).toHaveBeenCalledWith(TAC_CHANNELS.watchStart, { rootDir: '/r', debounceMs: 100 });
    expect(await api.watchStop('w1')).toEqual({ stopped: true });
  });

  it('throws Error with message + code when IpcResponse.success is false', async () => {
    const invoke = vi.fn(async () => err('boom', 'E_BOOM'));
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    await expect(api.importYaml('/x')).rejects.toMatchObject({ message: 'boom', code: 'E_BOOM' });
  });

  it('onWatchEvent subscribes to watchEvent channel and forwards envelope', () => {
    let captured: ((...a: unknown[]) => void) | null = null;
    const off = vi.fn();
    const on = vi.fn((ch: string, cb: (...a: unknown[]) => void) => {
      expect(ch).toBe(TAC_CHANNELS.watchEvent);
      captured = cb;
      return off;
    });
    const api = createTaskAsCodeApi({ invoke: vi.fn(), on });
    const callback = vi.fn();
    const unsub = api.onWatchEvent(callback);
    captured!({ watchId: 'w1', event: { at: 1, tasks: [], templates: [], removedPaths: [] } });
    expect(callback).toHaveBeenCalledOnce();
    expect(callback.mock.calls[0]![0]).toMatchObject({ watchId: 'w1' });
    unsub();
    expect(off).toHaveBeenCalled();
  });

  it('onWatchEvent ignores malformed envelopes (no watchId)', () => {
    let captured: ((...a: unknown[]) => void) | null = null;
    const on = vi.fn((_ch, cb) => { captured = cb; return () => undefined; });
    const api = createTaskAsCodeApi({ invoke: vi.fn(), on });
    const callback = vi.fn();
    api.onWatchEvent(callback);
    captured!(undefined);
    captured!({ event: {} });
    captured!('not-an-object');
    expect(callback).not.toHaveBeenCalled();
  });
});
