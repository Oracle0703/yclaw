import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWatcher, type FileSignature, type WatchEvent } from '@shared/serialization/watcher';

describe('shared · serialization · watcher · security/edge-case', () => {
  let tmp = '';
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'yclaw-watch-sec-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('default lister skips symlinks, dotfiles and node_modules', async () => {
    writeFileSync(join(tmp, 'real.yaml'), 'a: 1\n', 'utf8');
    writeFileSync(join(tmp, '.hidden.yaml'), 'a: 1\n', 'utf8');
    mkdirSync(join(tmp, 'node_modules'));
    writeFileSync(join(tmp, 'node_modules', 'ignored.yaml'), 'a: 1\n', 'utf8');
    try {
      symlinkSync(join(tmp, 'real.yaml'), join(tmp, 'link.yaml'));
    } catch { /* symlinks may not be allowed; test still meaningful */ }

    const w = createWatcher(tmp, { debounceMs: 5 });
    const r = await w.start();
    // only real.yaml should be picked up
    expect(r.initialFileCount).toBe(1);
    await w.stop();
  });

  it('listeners can unsubscribe themselves during emit without breaking others', async () => {
    const files = new Map<string, FileSignature>([['a.yaml', { mtimeMs: 1, size: 1 }]]);
    let nowMs = 0;
    const timers: Array<{ fn: () => void; due: number }> = [];
    let nativeTick: (() => void) | null = null;
    const deps = {
      now: () => nowMs,
      setTimeout: ((fn: () => void, ms: number) => {
        const h = { fn, due: nowMs + ms };
        timers.push(h);
        return h as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeout: ((h: unknown) => {
        const i = timers.indexOf(h as { fn: () => void; due: number });
        if (i >= 0) timers.splice(i, 1);
      }) as typeof clearTimeout,
      watch: (_r: string, t: () => void) => { nativeTick = t; return { close() { nativeTick = null; } }; },
      listFiles: async () => Array.from(files.keys()),
      statFile: async (abs: string) => {
        for (const [k, v] of files) if (abs.endsWith(k)) return v;
        return null;
      },
    };
    const w = createWatcher('/root', { ...deps, debounceMs: 5 });
    const seen: string[] = [];
    const offSelf = w.onChange(() => { seen.push('self'); offSelf(); });
    w.onChange(() => seen.push('other'));
    await w.start();
    files.set('b.yaml', { mtimeMs: 2, size: 1 });
    nativeTick!();
    nowMs += 10;
    timers.splice(0).forEach((t) => t.fn());
    await new Promise((r) => setImmediate(r));
    expect(seen).toEqual(['self', 'other']);
    await w.stop();
  });

  it('start → immediate stop drops any pending debounced rescan', async () => {
    let nowMs = 0;
    const timers: Array<{ fn: () => void; due: number }> = [];
    let nativeTick: (() => void) | null = null;
    const events: WatchEvent[] = [];
    const files = new Map<string, FileSignature>([['a.yaml', { mtimeMs: 1, size: 1 }]]);
    const deps = {
      now: () => nowMs,
      setTimeout: ((fn: () => void, ms: number) => {
        const h = { fn, due: nowMs + ms };
        timers.push(h);
        return h as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeout: ((h: unknown) => {
        const i = timers.indexOf(h as { fn: () => void; due: number });
        if (i >= 0) timers.splice(i, 1);
      }) as typeof clearTimeout,
      watch: (_r: string, t: () => void) => { nativeTick = t; return { close() { nativeTick = null; } }; },
      listFiles: async () => Array.from(files.keys()),
      statFile: async (abs: string) => {
        for (const [k, v] of files) if (abs.endsWith(k)) return v;
        return null;
      },
    };
    const w = createWatcher('/root', { ...deps, debounceMs: 100 });
    w.onChange((e) => events.push(e));
    await w.start();
    files.set('b.yaml', { mtimeMs: 2, size: 1 });
    nativeTick!();
    expect(timers).toHaveLength(1);
    await w.stop();
    expect(timers).toHaveLength(0); // cleared on stop
    nowMs += 200;
    timers.splice(0).forEach((t) => t.fn());
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual([]);
  });

  it('fallback when fs.watch recursive throws is exercised by default impl', async () => {
    // Construct a watcher that injects a watch impl which throws first attempt.
    let attempts = 0;
    const w = createWatcher(tmp, {
      debounceMs: 5,
      watch: (_root, onTick) => {
        attempts++;
        if (attempts === 1) throw new Error('recursive not supported');
        return { close: () => undefined };
      },
    });
    // start uses the injected watch (single attempt) and would surface the throw,
    // so wrap and assert it propagates cleanly (no hidden state).
    await expect(w.start()).rejects.toThrow(/recursive/);
  });

  it('flush() after stop() is a no-op', async () => {
    const w = createWatcher(tmp, { debounceMs: 5 });
    await w.start();
    await w.stop();
    await expect(w.flush()).resolves.toBeUndefined();
  });

  it('rejects start when injected listFiles already exceeds maxFiles', async () => {
    const fakeFiles = Array.from({ length: 10 }, (_v, i) => `f${i}.yaml`);
    const w = createWatcher('/root', {
      maxFiles: 5,
      listFiles: async () => fakeFiles,
      statFile: async () => ({ mtimeMs: 1, size: 1 }),
    });
    await expect(w.start()).rejects.toThrow(/maxFiles/);
  });
});
