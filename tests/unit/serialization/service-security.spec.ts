import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskAsCodeService, type Persistence } from '@shared/serialization/service';

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

function noopPersistence(): Persistence {
  return { upsertTask: () => undefined, upsertTemplate: () => undefined };
}

describe('shared · serialization · TaskAsCodeService · security/edge-case', () => {
  let tmp = '';
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tac-svc-sec-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('importPath surfaces persistence errors as a thrown rejection', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML, 'utf8');
    const svc = new TaskAsCodeService({
      upsertTask: () => { throw new Error('db down'); },
      upsertTemplate: () => undefined,
    });
    await expect(svc.importPath(file)).rejects.toThrow(/db down/);
  });

  it('importPath in directory mode aggregates per-file parse issues without aborting good files', async () => {
    writeFileSync(join(tmp, 'good.yaml'), TASK_YAML, 'utf8');
    writeFileSync(join(tmp, 'bad.yaml'), 'not-yaml: [unclosed\n', 'utf8');
    const svc = new TaskAsCodeService(noopPersistence());
    const r = await svc.importPath(tmp);
    expect(r.taskCount).toBe(1);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues.some((i) => /bad\.yaml/.test(i.path))).toBe(true);
  });

  it('importPath rejects symlink targets via injected stat returning null', async () => {
    const real = join(tmp, 'real.yaml');
    writeFileSync(real, TASK_YAML, 'utf8');
    const link = join(tmp, 'link.yaml');
    try { symlinkSync(real, link); } catch { /* skip on platforms without symlink */ return; }
    const svc = new TaskAsCodeService(noopPersistence(), {
      stat: async (p) => {
        // mimic safety policy: refuse symlinks by returning null
        const { promises: fsp } = await import('node:fs');
        const st = await fsp.lstat(p);
        if (st.isSymbolicLink()) return null;
        return st;
      },
    });
    const r = await svc.importPath(link);
    expect(r.taskCount).toBe(0);
    expect(r.issues[0].message).toMatch(/does not exist/);
  });

  it('exportTask round-trips through importPath via writing temp file', async () => {
    const svc = new TaskAsCodeService(noopPersistence());
    const yaml = svc.exportTask({
      id: 'rt1',
      name: 'roundtrip',
      steps: [{ id: 's', name: 'c', action: { type: 'click', selector: '#a' } }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }).yaml;
    const file = join(tmp, 'rt.yaml');
    writeFileSync(file, yaml, 'utf8');
    const collected: string[] = [];
    const svc2 = new TaskAsCodeService({
      upsertTask: (f) => { collected.push(f.id); },
      upsertTemplate: () => undefined,
    });
    const r = await svc2.importPath(file);
    expect(r.taskCount).toBe(1);
    expect(collected).toEqual(['rt1']);
  });

  it('watchDirectory stop() is idempotent', async () => {
    const svc = new TaskAsCodeService(noopPersistence(), { now: () => 0 });
    const handle = await svc.watchDirectory(tmp, () => undefined, { debounceMs: 5 });
    await handle.stop();
    await expect(handle.stop()).resolves.toBeUndefined();
  });

  it('watchDirectory swallows classifyEvent errors so listener stays alive', async () => {
    let nowMs = 0;
    const timers: Array<() => void> = [];
    let nativeTick: (() => void) | null = null;
    const files = new Map<string, { mtimeMs: number; size: number }>([['a.yaml', { mtimeMs: 1, size: 1 }]]);
    const watcherDeps = {
      now: () => nowMs,
      setTimeout: ((fn: () => void) => { timers.push(fn); return fn as unknown as ReturnType<typeof setTimeout>; }) as typeof setTimeout,
      clearTimeout: ((h: unknown) => { const i = timers.indexOf(h as () => void); if (i >= 0) timers.splice(i, 1); }) as typeof clearTimeout,
      watch: (_r: string, t: () => void) => { nativeTick = t; return { close() { nativeTick = null; } }; },
      listFiles: async () => Array.from(files.keys()),
      statFile: async (abs: string) => {
        for (const [k, v] of files) if (abs.endsWith(k)) return v;
        return null;
      },
    };
    const svc = new TaskAsCodeService(noopPersistence(), {
      now: () => nowMs,
      readFile: async () => { throw new Error('boom'); },
    });
    const events: unknown[] = [];
    const handle = await svc.watchDirectory('/root', (e) => events.push(e), { ...watcherDeps, debounceMs: 5 });
    files.set('b.yaml', { mtimeMs: 2, size: 1 });
    nativeTick!();
    nowMs += 10;
    timers.splice(0).forEach((fn) => fn());
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    // Event still fires because change classification reports issues, not crash.
    expect(events).toHaveLength(1);
    await handle.stop();
  });
});
