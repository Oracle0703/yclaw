import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskAsCodeService, type Persistence } from '@shared/serialization/service';
import type { TaskFlow } from '@shared/types/task';

const TASK_YAML = [
  'schemaVersion: 1',
  'kind: Task',
  'metadata:',
  '  id: t-conc',
  '  name: c',
  'spec:',
  '  steps:',
  "    - id: s1",
  '      name: c',
  "      action: { type: click, selector: '#a' }",
  '',
].join('\n');

describe('shared · serialization · TaskAsCodeService · concurrent async hooks', () => {
  let tmp = '';
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tac-idem-conc-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('parallel importPath calls preserve existingCreatedAt for both invocations', async () => {
    const tasks = new Map<string, TaskFlow>();
    let lookupCount = 0;
    const persistence: Persistence = {
      upsertTask: (f) => { tasks.set(f.id, f); },
      upsertTemplate: () => undefined,
      // 模拟「带异步延迟」的查询钩子，迫使两路 import 真正并发跨过 await。
      findExistingTaskCreatedAt: async (id) => {
        lookupCount++;
        await new Promise((r) => setTimeout(r, 5));
        return tasks.get(id)?.createdAt ?? null;
      },
      findExistingTemplateCreatedAt: async () => null,
    };
    const svc = new TaskAsCodeService(persistence);
    writeFileSync(join(tmp, 'a.task.yaml'), TASK_YAML, 'utf8');

    // 第一次 import 建立 createdAt。
    await svc.importPath(tmp);
    const created = tasks.get('t-conc')!.createdAt;
    expect(created).toBeTruthy();

    // 并发第二/第三次 import：两路都应读到同一 createdAt 且不被覆盖。
    const before = lookupCount;
    await Promise.all([svc.importPath(tmp), svc.importPath(tmp)]);
    expect(lookupCount).toBeGreaterThanOrEqual(before + 2);
    expect(tasks.get('t-conc')!.createdAt).toBe(created);
  });

  it('rejection from async hook does not leak; createdAt falls back to nowIso', async () => {
    const upserts: TaskFlow[] = [];
    const persistence: Persistence = {
      upsertTask: (f) => { upserts.push(f); },
      upsertTemplate: () => undefined,
      findExistingTaskCreatedAt: async () => {
        await new Promise((r) => setTimeout(r, 1));
        throw new Error('db transient');
      },
    };
    const svc = new TaskAsCodeService(persistence);
    writeFileSync(join(tmp, 'a.task.yaml'), TASK_YAML, 'utf8');
    await expect(svc.importPath(tmp)).resolves.toMatchObject({ taskCount: 1 });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].createdAt).toBe(upserts[0].updatedAt);
  });
});
