import { describe, expect, it, vi } from 'vitest';
import { createTaskAsCodeApi, isWatchEnvelope } from '@renderer/shared/api/taskAsCode';
import { TAC_CHANNELS } from '@shared/constants';

describe('renderer · api · taskAsCode edge cases', () => {
  it('watchStart omits debounceMs when caller does not supply it', async () => {
    const invoke = vi.fn(async () => ({ success: true, data: { watchId: 'w', initialFileCount: 0 } }));
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    await api.watchStart('/r');
    expect(invoke).toHaveBeenCalledWith(TAC_CHANNELS.watchStart, { rootDir: '/r' });
  });

  it('unwrap surfaces fallback message embedding code when error.message missing', async () => {
    const invoke = vi.fn(async () => ({ success: false, error: { code: 'X' } } as never));
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    await expect(api.watchStop('w')).rejects.toThrow(/IPC call failed \(X\)/);
  });

  it('unwrap surfaces generic message when no code and no message', async () => {
    const invoke = vi.fn(async () => ({ success: false, error: {} } as never));
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    await expect(api.watchStop('w')).rejects.toThrow(/^IPC call failed$/);
  });

  it('unwrap treats empty-string code as no code (no parens)', async () => {
    const invoke = vi.fn(async () => ({ success: false, error: { code: '' } } as never));
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    await expect(api.watchStop('w')).rejects.toThrow(/^IPC call failed$/);
  });

  it('isWatchEnvelope predicate', () => {
    expect(isWatchEnvelope({ watchId: 'w', event: { at: 1, tasks: [], templates: [], removedPaths: [] } })).toBe(true);
    expect(isWatchEnvelope({ watchId: 'w' })).toBe(false);
    expect(isWatchEnvelope({ event: {} })).toBe(false);
    expect(isWatchEnvelope({ watchId: 1, event: {} })).toBe(false);
    expect(isWatchEnvelope(null)).toBe(false);
    expect(isWatchEnvelope(undefined)).toBe(false);
    expect(isWatchEnvelope('x')).toBe(false);
  });

  it('exportYaml with template kind sends template payload', async () => {
    const invoke = vi.fn(async () => ({ success: true, data: { yaml: '' } }));
    const api = createTaskAsCodeApi({ invoke, on: () => () => undefined });
    const tpl = { id: 't', name: 'n', fields: [], createdAt: '', updatedAt: '' } as never;
    await api.exportYaml('template', tpl);
    expect(invoke.mock.calls[0]![1]).toMatchObject({ kind: 'template', payload: { id: 't' } });
  });
});
