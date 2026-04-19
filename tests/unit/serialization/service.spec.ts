import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TaskAsCodeService,
  type AffectedEvent,
  type Persistence,
} from '@shared/serialization/service';
import type { ExtractionTemplate, TaskFlow } from '@shared/types/task';

const TASK_YAML = [
  'schemaVersion: 1',
  'kind: Task',
  'metadata:',
  '  id: t1',
  '  name: 任务一',
  'spec:',
  '  steps:',
  "    - id: s1",
  '      name: click home',
  "      action: { type: click, selector: '#home' }",
  '',
].join('\n');

const TPL_YAML = [
  'schemaVersion: 1',
  'kind: Template',
  'metadata:',
  '  id: tpl1',
  '  name: 模板一',
  'spec:',
  '  fields:',
  '    - name: title',
  '      selector: h1',
  '      type: text',
  '      attribute: text',
  '',
].join('\n');

function makePersistence(): Persistence & { tasks: TaskFlow[]; templates: ExtractionTemplate[] } {
  const tasks: TaskFlow[] = [];
  const templates: ExtractionTemplate[] = [];
  return {
    tasks,
    templates,
    upsertTask: (f) => { tasks.push(f); },
    upsertTemplate: (t) => { templates.push(t); },
  };
}

describe('shared · serialization · TaskAsCodeService', () => {
  let tmp = '';
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tac-svc-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('importPath imports a single YAML file via persistence', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML, 'utf8');
    const p = makePersistence();
    const svc = new TaskAsCodeService(p, { now: () => Date.parse('2026-04-20T00:00:00Z') });
    const r = await svc.importPath(file);
    expect(r).toEqual({ taskCount: 1, templateCount: 0, issues: [] });
    expect(p.tasks).toHaveLength(1);
    expect(p.tasks[0].id).toBe('t1');
    expect(p.tasks[0].createdAt).toBe('2026-04-20T00:00:00.000Z');
  });

  it('importPath imports a directory of mixed task + template', async () => {
    writeFileSync(join(tmp, 'a.yaml'), TASK_YAML, 'utf8');
    writeFileSync(join(tmp, 'b.template.yaml'), TPL_YAML, 'utf8');
    const p = makePersistence();
    const svc = new TaskAsCodeService(p);
    const r = await svc.importPath(tmp);
    expect(r.taskCount).toBe(1);
    expect(r.templateCount).toBe(1);
    expect(p.tasks[0].id).toBe('t1');
    expect(p.templates[0].id).toBe('tpl1');
  });

  it('importPath returns issues for non-existent path without throwing', async () => {
    const p = makePersistence();
    const svc = new TaskAsCodeService(p);
    const r = await svc.importPath(join(tmp, 'no-such.yaml'));
    expect(r.taskCount).toBe(0);
    expect(r.templateCount).toBe(0);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].message).toMatch(/does not exist/);
    expect(p.tasks).toHaveLength(0);
  });

  it('importPath surfaces parse errors via issues', async () => {
    const file = join(tmp, 'bad.yaml');
    writeFileSync(file, ': : :\n', 'utf8');
    const p = makePersistence();
    const svc = new TaskAsCodeService(p);
    const r = await svc.importPath(file);
    expect(r.taskCount).toBe(0);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('exportTask serialises a TaskFlow to YAML', () => {
    const svc = new TaskAsCodeService(makePersistence());
    const yaml = svc.exportTask({
      id: 'x1',
      name: 'X',
      steps: [{ id: 's', name: 'click', action: { type: 'click', selector: '#a' } }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }).yaml;
    expect(yaml).toMatch(/kind: Task/);
    expect(yaml).toMatch(/id: x1/);
  });

  it('exportTemplate serialises an ExtractionTemplate to YAML', () => {
    const svc = new TaskAsCodeService(makePersistence());
    const yaml = svc.exportTemplate({
      id: 'tpl-x',
      name: 'X',
      fields: [{ name: 'title', selector: 'h1', attribute: 'text' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }).yaml;
    expect(yaml).toMatch(/kind: Template/);
    expect(yaml).toMatch(/id: tpl-x/);
  });

  it('watchDirectory classifies added/changed/removed via injected fakes', async () => {
    let nowMs = 0;
    const timers: Array<{ fn: () => void }> = [];
    let nativeTick: (() => void) | null = null;
    const files = new Map<string, { mtimeMs: number; size: number; text: string }>();
    files.set('a.yaml', { mtimeMs: 1, size: TASK_YAML.length, text: TASK_YAML });
    const deps = {
      now: () => nowMs,
      readFile: async (abs: string) => {
        for (const [k, v] of files) if (abs.endsWith(k)) return v.text;
        throw new Error('ENOENT');
      },
      stat: async () => null, // not used because we call watchDirectory not importPath
    };
    const watcherDeps = {
      setTimeout: ((fn: () => void, _ms: number) => {
        const h = { fn };
        timers.push(h);
        return h as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeout: ((h: unknown) => {
        const i = timers.indexOf(h as { fn: () => void });
        if (i >= 0) timers.splice(i, 1);
      }) as typeof clearTimeout,
      watch: (_root: string, t: () => void) => { nativeTick = t; return { close() { nativeTick = null; } }; },
      listFiles: async () => Array.from(files.keys()),
      statFile: async (abs: string) => {
        for (const [k, v] of files) if (abs.endsWith(k)) return { mtimeMs: v.mtimeMs, size: v.size };
        return null;
      },
    };
    const svc = new TaskAsCodeService(makePersistence(), deps);
    const events: AffectedEvent[] = [];
    const handle = await svc.watchDirectory('/root', (e) => events.push(e), { ...watcherDeps, debounceMs: 5 });
    expect(handle.initialFileCount).toBe(1);

    // add a template
    files.set('b.template.yaml', { mtimeMs: 2, size: TPL_YAML.length, text: TPL_YAML });
    nativeTick!();
    nowMs += 10;
    timers.splice(0).forEach((t) => t.fn());
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(events).toHaveLength(1);
    expect(events[0].templates).toContain('tpl1');
    expect(events[0].tasks).not.toContain('t1');

    // change task
    files.set('a.yaml', { mtimeMs: 99, size: TASK_YAML.length, text: TASK_YAML });
    nativeTick!();
    nowMs += 10;
    timers.splice(0).forEach((t) => t.fn());
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(events[1].tasks).toContain('t1');

    // remove
    files.delete('b.template.yaml');
    nativeTick!();
    nowMs += 10;
    timers.splice(0).forEach((t) => t.fn());
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(events[2].removedPaths).toContain('b.template.yaml');

    await handle.stop();
  });
});
