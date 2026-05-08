import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskAsCodeService } from '@shared/serialization/service';
import {
  createRepositoryPersistence,
  type TaskRepositoryLike,
  type TemplateRepositoryLike,
} from '@main/services/task-as-code/RepositoryPersistence';
import type { TaskFlow, ExtractionTemplate } from '@shared/types/task';

function makeTaskRepo(): TaskRepositoryLike & { saved: TaskFlow[]; created: Map<string, string> } {
  const created = new Map<string, string>();
  const saved: TaskFlow[] = [];
  return {
    saved, created,
    saveTaskFlow: (f) => {
      saved.push(f);
      if (!created.has(f.id)) created.set(f.id, f.createdAt);
    },
    getTaskCreatedAt: (id) => created.get(id) ?? null,
  };
}

function makeTemplateRepo(): TemplateRepositoryLike & { saved: ExtractionTemplate[]; created: Map<string, string> } {
  const created = new Map<string, string>();
  const saved: ExtractionTemplate[] = [];
  return {
    saved, created,
    saveTemplate: (t) => {
      saved.push(t);
      if (!created.has(t.id)) created.set(t.id, t.createdAt);
      return t;
    },
    getTemplateCreatedAt: (id) => created.get(id) ?? null,
  };
}

describe('main · services · task-as-code · createRepositoryPersistence', () => {
  it('upsertTask delegates to saveTaskFlow', () => {
    const repo = makeTaskRepo();
    const tmpl = makeTemplateRepo();
    const p = createRepositoryPersistence({ taskRepository: repo, templateRepository: tmpl });
    p.upsertTask({
      id: 't1', name: 'n', steps: [],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].id).toBe('t1');
  });

  it('upsertTemplate delegates to saveTemplate', () => {
    const repo = makeTaskRepo();
    const tmpl = makeTemplateRepo();
    const p = createRepositoryPersistence({ taskRepository: repo, templateRepository: tmpl });
    p.upsertTemplate({
      id: 'tpl', name: 'n', fields: [],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(tmpl.saved).toHaveLength(1);
  });

  it('findExisting* hooks return Repository getCreatedAt result', () => {
    const repo = makeTaskRepo();
    const tmpl = makeTemplateRepo();
    repo.created.set('t1', '2024-01-01T00:00:00.000Z');
    tmpl.created.set('tpl', '2024-02-01T00:00:00.000Z');
    const p = createRepositoryPersistence({ taskRepository: repo, templateRepository: tmpl });
    expect(p.findExistingTaskCreatedAt!('t1')).toBe('2024-01-01T00:00:00.000Z');
    expect(p.findExistingTaskCreatedAt!('missing')).toBe(null);
    expect(p.findExistingTemplateCreatedAt!('tpl')).toBe('2024-02-01T00:00:00.000Z');
  });

  it('end-to-end: importPath via repo persistence preserves createdAt across two imports', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tac-repo-adapter-'));
    try {
      const file = join(tmp, 'a.yaml');
      writeFileSync(file, [
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
      ].join('\n'), 'utf8');

      const repo = makeTaskRepo();
      const tmpl = makeTemplateRepo();
      let nowMs = 1_700_000_000_000;
      const svc = new TaskAsCodeService(
        createRepositoryPersistence({ taskRepository: repo, templateRepository: tmpl }),
        { now: () => nowMs },
      );

      await svc.importPath(file);
      const c1 = repo.saved[0].createdAt;
      const u1 = repo.saved[0].updatedAt;
      expect(c1).toBe(u1);

      nowMs += 10_000;
      await svc.importPath(file);
      expect(repo.saved).toHaveLength(2);
      expect(repo.saved[1].createdAt).toBe(c1);
      expect(repo.saved[1].updatedAt).not.toBe(u1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('repo throwing inside saveTaskFlow propagates as importPath rejection', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tac-repo-adapter-err-'));
    try {
      const file = join(tmp, 'a.yaml');
      writeFileSync(file, [
        'schemaVersion: 1',
        'kind: Task',
        'metadata: { id: t1, name: t }',
        'spec:',
        '  steps:',
        "    - { id: s1, name: c, action: { type: click, selector: '#a' } }",
        '',
      ].join('\n'), 'utf8');
      const repo: TaskRepositoryLike = {
        saveTaskFlow: vi.fn(() => { throw new Error('db locked'); }),
        getTaskCreatedAt: () => null,
      };
      const tmpl = makeTemplateRepo();
      const svc = new TaskAsCodeService(
        createRepositoryPersistence({ taskRepository: repo, templateRepository: tmpl }),
        { now: () => 1_700_000_000_000 },
      );
      await expect(svc.importPath(file)).rejects.toThrow(/db locked/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
