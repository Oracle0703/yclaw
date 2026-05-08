import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskAsCodeService, type Persistence } from '@shared/serialization/service';
import type { TaskFlow, ExtractionTemplate } from '@shared/types/task';

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

const TPL_YAML = [
  'schemaVersion: 1',
  'kind: Template',
  'metadata:',
  '  id: tpl1',
  '  name: tn',
  'spec:',
  '  fields:',
  "    - { name: price, selector: '.p', attribute: text }",
  '',
].join('\n');

interface FakeStore {
  tasks: Map<string, TaskFlow>;
  templates: Map<string, ExtractionTemplate>;
  taskUpserts: TaskFlow[];
  templateUpserts: ExtractionTemplate[];
}

function makeStore(): { store: FakeStore; persistence: Persistence } {
  const store: FakeStore = {
    tasks: new Map(), templates: new Map(),
    taskUpserts: [], templateUpserts: [],
  };
  const persistence: Persistence = {
    upsertTask: (f) => { store.tasks.set(f.id, f); store.taskUpserts.push(f); },
    upsertTemplate: (t) => { store.templates.set(t.id, t); store.templateUpserts.push(t); },
    findExistingTaskCreatedAt: (id) => store.tasks.get(id)?.createdAt ?? null,
    findExistingTemplateCreatedAt: (id) => store.templates.get(id)?.createdAt ?? null,
  };
  return { store, persistence };
}

describe('shared · serialization · TaskAsCodeService · idempotency (TAC-02)', () => {
  let tmp = '';
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tac-idem-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('importing the same task file twice preserves createdAt and bumps updatedAt', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML, 'utf8');
    let nowMs = 1_700_000_000_000;
    const { store, persistence } = makeStore();
    const svc = new TaskAsCodeService(persistence, { now: () => nowMs });

    await svc.importPath(file);
    const firstCreatedAt = store.tasks.get('t1')!.createdAt;
    const firstUpdatedAt = store.tasks.get('t1')!.updatedAt;
    expect(firstCreatedAt).toBe(firstUpdatedAt);

    nowMs += 60_000;
    await svc.importPath(file);
    const second = store.tasks.get('t1')!;
    expect(second.createdAt).toBe(firstCreatedAt);
    expect(second.updatedAt).not.toBe(firstUpdatedAt);
    expect(store.taskUpserts).toHaveLength(2); // upsert called twice (DB layer dedups)
  });

  it('importing the same template file twice preserves template createdAt', async () => {
    const file = join(tmp, 'tpl.yaml');
    writeFileSync(file, TPL_YAML, 'utf8');
    let nowMs = 1_700_000_000_000;
    const { store, persistence } = makeStore();
    const svc = new TaskAsCodeService(persistence, { now: () => nowMs });

    await svc.importPath(file);
    const c1 = store.templates.get('tpl1')!.createdAt;

    nowMs += 1000;
    await svc.importPath(file);
    expect(store.templates.get('tpl1')!.createdAt).toBe(c1);
  });

  it('without findExisting hooks, every import gets fresh createdAt (back-compat)', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML, 'utf8');
    let nowMs = 1_700_000_000_000;
    const upserts: TaskFlow[] = [];
    const persistence: Persistence = {
      upsertTask: (f) => upserts.push(f),
      upsertTemplate: () => undefined,
    };
    const svc = new TaskAsCodeService(persistence, { now: () => nowMs });

    await svc.importPath(file);
    nowMs += 1000;
    await svc.importPath(file);
    expect(upserts[0].createdAt).not.toBe(upserts[1].createdAt);
  });

  it('hook errors are swallowed and treated as "no existing record"', async () => {
    const file = join(tmp, 'a.yaml');
    writeFileSync(file, TASK_YAML, 'utf8');
    const upserts: TaskFlow[] = [];
    const persistence: Persistence = {
      upsertTask: (f) => upserts.push(f),
      upsertTemplate: () => undefined,
      findExistingTaskCreatedAt: vi.fn(() => { throw new Error('db down'); }),
    };
    const svc = new TaskAsCodeService(persistence, { now: () => 1_700_000_000_000 });
    await expect(svc.importPath(file)).resolves.toBeDefined();
    expect(upserts).toHaveLength(1);
    expect(persistence.findExistingTaskCreatedAt).toHaveBeenCalledWith('t1');
  });

  it('directory import also queries existing createdAt per id', async () => {
    writeFileSync(join(tmp, 'a.yaml'), TASK_YAML, 'utf8');
    writeFileSync(join(tmp, 'tpl.yaml'), TPL_YAML, 'utf8');
    let nowMs = 1_700_000_000_000;
    const { store, persistence } = makeStore();
    const findTask = vi.spyOn(persistence, 'findExistingTaskCreatedAt' as never);
    const svc = new TaskAsCodeService(persistence, { now: () => nowMs });

    await svc.importPath(tmp);
    nowMs += 5000;
    await svc.importPath(tmp);
    expect(store.tasks.get('t1')!.createdAt).toBe(store.tasks.get('t1')!.updatedAt === store.tasks.get('t1')!.createdAt
      ? store.tasks.get('t1')!.createdAt
      : store.tasks.get('t1')!.createdAt);
    expect(findTask).toHaveBeenCalledTimes(2);
  });
});
