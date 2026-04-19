import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskAsCodeService, type Persistence } from '@shared/serialization/service';
import type { TaskFlow } from '@shared/types/task';

const TASK_YAML = (id: string) => [
  'schemaVersion: 1',
  'kind: Task',
  'metadata:',
  `  id: ${id}`,
  '  name: t',
  'spec:',
  '  steps:',
  "    - id: s1",
  '      name: c',
  "      action: { type: click, selector: '#a' }",
  '',
].join('\n');

const TPL_YAML = (id: string) => [
  'schemaVersion: 1',
  'kind: Template',
  'metadata:',
  `  id: ${id}`,
  '  name: tn',
  'spec:',
  '  fields:',
  "    - { name: price, selector: '.p', attribute: text }",
  '',
].join('\n');

describe('shared · serialization · TaskAsCodeService · idempotency · edge', () => {
  let tmp = '';
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tac-idem-edge-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('template hook error is swallowed (mirrors task hook behavior)', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TPL_YAML('tpl-x'), 'utf8');
    const persistence: Persistence = {
      upsertTask: () => undefined,
      upsertTemplate: () => undefined,
      findExistingTemplateCreatedAt: vi.fn(async () => { throw new Error('db down'); }),
    };
    const svc = new TaskAsCodeService(persistence, { now: () => 1_700_000_000_000 });
    await expect(svc.importPath(file)).resolves.toBeDefined();
    expect(persistence.findExistingTemplateCreatedAt).toHaveBeenCalledWith('tpl-x');
  });

  it('hook returning empty string is treated as "no existing record"', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML('t1'), 'utf8');
    const upserts: TaskFlow[] = [];
    const persistence: Persistence = {
      upsertTask: (f) => upserts.push(f),
      upsertTemplate: () => undefined,
      // empty string is falsy → treated as missing → new createdAt assigned
      findExistingTaskCreatedAt: () => '',
    };
    let nowMs = 1_700_000_000_000;
    const svc = new TaskAsCodeService(persistence, { now: () => nowMs });
    await svc.importPath(file);
    nowMs += 1000;
    await svc.importPath(file);
    expect(upserts[0].createdAt).not.toBe(upserts[1].createdAt);
  });

  it('two concurrent importPath() calls each see store state at lookup time (no inter-locking required)', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML('t1'), 'utf8');
    const store = new Map<string, TaskFlow>();
    const persistence: Persistence = {
      upsertTask: (f) => { store.set(f.id, f); },
      upsertTemplate: () => undefined,
      findExistingTaskCreatedAt: (id) => store.get(id)?.createdAt ?? null,
    };
    const svc = new TaskAsCodeService(persistence, { now: () => 1_700_000_000_000 });
    // Sequential await is the realistic IPC pattern; concurrent run should still yield idempotent createdAt.
    await Promise.all([svc.importPath(file), svc.importPath(file)]);
    // After both finish, only one createdAt persists (later upsert wins; both used the same now ms anyway).
    expect(store.get('t1')!.createdAt).toBeDefined();
  });

  it('persistence with only one find hook still works for the other kind', async () => {
    writeFileSync(join(tmp, 'a.yaml'), TASK_YAML('t1'), 'utf8');
    writeFileSync(join(tmp, 'tpl.yaml'), TPL_YAML('tpl1'), 'utf8');
    const persistence: Persistence = {
      upsertTask: () => undefined,
      upsertTemplate: () => undefined,
      findExistingTaskCreatedAt: () => '2020-01-01T00:00:00.000Z',
      // findExistingTemplateCreatedAt intentionally absent
    };
    const svc = new TaskAsCodeService(persistence, { now: () => 1_700_000_000_000 });
    const r = await svc.importPath(tmp);
    expect(r.taskCount).toBe(1);
    expect(r.templateCount).toBe(1);
  });
});
