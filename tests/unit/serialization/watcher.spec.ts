import { describe, it, expect } from 'vitest';
import { createWatcher, type FileSignature, type WatchEvent } from '@shared/serialization/watcher';

interface FakeFs {
  files: Map<string, FileSignature>;
}

function makeDeps(fs: FakeFs) {
  // controllable timer
  const timers: Array<{ id: number; fn: () => void; ms: number; due: number }> = [];
  let nextId = 1;
  let nowMs = 1_000;
  const subscribers: Array<() => void> = [];
  return {
    fs,
    timers,
    advance(ms: number) {
      nowMs += ms;
      const due = timers.filter((t) => t.due <= nowMs);
      for (const t of due) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
    },
    triggerNative() {
      for (const s of [...subscribers]) s();
    },
    deps: {
      now: () => nowMs,
      setTimeout: ((fn: () => void, ms: number) => {
        const id = nextId++;
        const handle = { id, fn, ms, due: nowMs + ms };
        timers.push(handle);
        return handle as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeout: ((handle: unknown) => {
        const i = timers.findIndex((t) => t === handle);
        if (i >= 0) timers.splice(i, 1);
      }) as typeof clearTimeout,
      watch: (_root: string, onTick: () => void) => {
        subscribers.push(onTick);
        return {
          close() {
            const i = subscribers.indexOf(onTick);
            if (i >= 0) subscribers.splice(i, 1);
          },
        };
      },
      listFiles: async (_root: string) => Array.from(fs.files.keys()).sort(),
      statFile: async (absPath: string) => {
        // strip root prefix; deps see only relative-shaped keys, so just test endsWith
        for (const [rel, sig] of fs.files) {
          if (absPath.endsWith(rel)) return sig;
        }
        return null;
      },
    },
  };
}

describe('shared · serialization · watcher', () => {
  it('start() establishes baseline and emits no events', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 50 });
    w.onChange((e) => events.push(e));
    const r = await w.start();
    expect(r.initialFileCount).toBe(1);
    expect(events).toEqual([]);
    await w.stop();
  });

  it('detects added files after debounce', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 50 });
    w.onChange((e) => events.push(e));
    await w.start();
    fs.files.set('b.yaml', { mtimeMs: 200, size: 5 });
    ctx.triggerNative();
    expect(events).toEqual([]); // debounce in flight
    ctx.advance(60);
    // setTimeout's fn schedules an async rescan; let microtasks flush
    await new Promise((r) => setImmediate(r));
    expect(events).toHaveLength(1);
    expect(events[0].changes.map((c) => `${c.kind}:${c.relativePath}`)).toEqual(['added:b.yaml']);
    await w.stop();
  });

  it('detects changed (mtime/size) and removed', async () => {
    const fs: FakeFs = {
      files: new Map([
        ['a.yaml', { mtimeMs: 100, size: 10 }],
        ['b.yaml', { mtimeMs: 200, size: 5 }],
      ]),
    };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 10 });
    w.onChange((e) => events.push(e));
    await w.start();
    fs.files.set('a.yaml', { mtimeMs: 999, size: 10 }); // mtime changed
    fs.files.delete('b.yaml');
    ctx.triggerNative();
    ctx.advance(20);
    await new Promise((r) => setImmediate(r));
    expect(events).toHaveLength(1);
    const kinds = events[0].changes.map((c) => `${c.kind}:${c.relativePath}`).sort();
    expect(kinds).toEqual(['changed:a.yaml', 'removed:b.yaml']);
    await w.stop();
  });

  it('debounces multiple rapid native ticks into one event', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 100 });
    w.onChange((e) => events.push(e));
    await w.start();
    fs.files.set('b.yaml', { mtimeMs: 200, size: 5 });
    ctx.triggerNative();
    ctx.advance(50);
    ctx.triggerNative();
    ctx.advance(50);
    ctx.triggerNative();
    ctx.advance(120);
    await new Promise((r) => setImmediate(r));
    expect(events).toHaveLength(1);
    expect(events[0].changes).toHaveLength(1);
    await w.stop();
  });

  it('emits no event when nothing changed', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 10 });
    w.onChange((e) => events.push(e));
    await w.start();
    ctx.triggerNative();
    ctx.advance(20);
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual([]);
    await w.stop();
  });

  it('flush() runs an immediate rescan and bypasses debounce', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 10_000 });
    w.onChange((e) => events.push(e));
    await w.start();
    fs.files.set('b.yaml', { mtimeMs: 200, size: 5 });
    await w.flush();
    expect(events).toHaveLength(1);
    await w.stop();
  });

  it('start() rejects when directory exceeds maxFiles', async () => {
    const files = new Map<string, FileSignature>();
    for (let i = 0; i < 5; i++) files.set(`f${i}.yaml`, { mtimeMs: 1, size: 1 });
    const fs: FakeFs = { files };
    const ctx = makeDeps(fs);
    const w = createWatcher('/root', { ...ctx.deps, maxFiles: 3 });
    await expect(w.start()).rejects.toThrow(/maxFiles/);
  });

  it('listener errors do not break the watcher', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const good: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 5 });
    w.onChange(() => { throw new Error('boom'); });
    w.onChange((e) => good.push(e));
    await w.start();
    fs.files.set('b.yaml', { mtimeMs: 1, size: 1 });
    ctx.triggerNative();
    ctx.advance(10);
    await new Promise((r) => setImmediate(r));
    expect(good).toHaveLength(1);
    await w.stop();
  });

  it('onChange returns an unsubscribe function', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 5 });
    const off = w.onChange((e) => events.push(e));
    await w.start();
    off();
    fs.files.set('b.yaml', { mtimeMs: 1, size: 1 });
    ctx.triggerNative();
    ctx.advance(10);
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual([]);
    await w.stop();
  });

  it('stop() is idempotent and clears pending debounced work', async () => {
    const fs: FakeFs = { files: new Map([['a.yaml', { mtimeMs: 100, size: 10 }]]) };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 100 });
    w.onChange((e) => events.push(e));
    await w.start();
    fs.files.set('b.yaml', { mtimeMs: 1, size: 1 });
    ctx.triggerNative();
    await w.stop();
    ctx.advance(200);
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual([]);
    await w.stop();
  });

  it('start() throws if called twice', async () => {
    const fs: FakeFs = { files: new Map() };
    const ctx = makeDeps(fs);
    const w = createWatcher('/root', { ...ctx.deps, debounceMs: 5 });
    await w.start();
    await expect(w.start()).rejects.toThrow(/already/);
    await w.stop();
  });

  it('treats Windows-style separators returned by listFiles as opaque keys (no false add/remove)', async () => {
    // 模拟 Windows 平台下未做 POSIX 归一的 listFiles 实现：rel 中带反斜杠。
    // watcher 把 rel 当作不透明 Map key，因此连续两次 scan 不应产生伪 added/removed。
    const fs: FakeFs = {
      files: new Map([
        ['sub\\a.yaml', { mtimeMs: 100, size: 10 }],
        ['sub\\b.yaml', { mtimeMs: 200, size: 5 }],
      ]),
    };
    const ctx = makeDeps(fs);
    const events: WatchEvent[] = [];
    const w = createWatcher('C:\\root', { ...ctx.deps, debounceMs: 5 });
    w.onChange((e) => events.push(e));
    const r = await w.start();
    expect(r.initialFileCount).toBe(2);
    // 没有真实变化：再 trigger 一次 + flush，应当无事件。
    ctx.triggerNative();
    ctx.advance(10);
    await new Promise((res) => setImmediate(res));
    expect(events).toEqual([]);
    // 真实变更：删除一个、新增一个，确认 relativePath 透传原始反斜杠。
    fs.files.delete('sub\\b.yaml');
    fs.files.set('sub\\c.yaml', { mtimeMs: 300, size: 7 });
    ctx.triggerNative();
    ctx.advance(10);
    await new Promise((res) => setImmediate(res));
    expect(events).toHaveLength(1);
    const kinds = events[0].changes.map((c) => `${c.kind}:${c.relativePath}`).sort();
    expect(kinds).toEqual(['added:sub\\c.yaml', 'removed:sub\\b.yaml']);
    await w.stop();
  });
});
