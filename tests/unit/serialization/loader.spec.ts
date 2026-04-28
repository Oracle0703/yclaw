import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDirectory, loadFile, resolveReferences, LOADER_SAFETY } from '@shared/serialization';

const TASK_A = `
schemaVersion: 1
kind: Task
metadata: { id: task-a, name: A }
spec:
  templateRef: tmpl-1
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#a' }
`;

const TASK_B_NO_REF = `
schemaVersion: 1
kind: Task
metadata: { id: task-b, name: B }
spec:
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#b' }
`;

const TEMPLATE_1 = `
schemaVersion: 1
kind: Template
metadata: { id: tmpl-1, name: T1 }
spec:
  fields:
    - name: title
      selector: 'h1'
      attribute: text
`;

describe('serialization · loader · loadFile', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yclaw-loader-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads a valid file', async () => {
    const p = join(dir, 'a.yaml');
    writeFileSync(p, TASK_A);
    const file = await loadFile(p);
    expect(file.kind).toBe('Task');
    expect(file.metadata.id).toBe('task-a');
  });

  it('throws on schema-invalid file with summary', async () => {
    const p = join(dir, 'bad.yaml');
    writeFileSync(
      p,
      `schemaVersion: 1\nkind: Task\nmetadata: { id: '!!', name: '' }\nspec: { steps: [] }\n`,
    );
    await expect(loadFile(p)).rejects.toThrow(/Failed to load/);
  });

  it('refuses symlink', async () => {
    const target = join(dir, 'real.yaml');
    writeFileSync(target, TASK_A);
    const link = join(dir, 'link.yaml');
    try {
      symlinkSync(target, link);
    } catch {
      return; /* skip when symlink not permitted */
    }
    await expect(loadFile(link)).rejects.toThrow(/symlink/i);
  });

  it('refuses oversize file', async () => {
    const p = join(dir, 'big.yaml');
    writeFileSync(p, '# pad\n'.repeat(LOADER_SAFETY.maxFileSize));
    await expect(loadFile(p)).rejects.toThrow(/exceeds limit/);
  });

  it('honors injected readFile', async () => {
    const p = join(dir, 'real.yaml');
    writeFileSync(p, TASK_A);
    // injected reader returns a different valid file
    const file = await loadFile(p, { readFile: async () => TEMPLATE_1 });
    expect(file.kind).toBe('Template');
  });
});

describe('serialization · loader · loadDirectory', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yclaw-loaddir-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('builds task and template registries', async () => {
    writeFileSync(join(dir, 'task-a.yaml'), TASK_A);
    writeFileSync(join(dir, 'tmpl-1.yaml'), TEMPLATE_1);
    const reg = await loadDirectory(dir);
    expect(reg.tasks.size).toBe(1);
    expect(reg.templates.size).toBe(1);
    expect(reg.issues).toHaveLength(0);
    expect(reg.tasks.get('task-a')?.file.metadata.name).toBe('A');
  });

  it('walks subdirectories, ignores dot/node_modules/symlinks', async () => {
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'task-a.yaml'), TASK_A);
    mkdirSync(join(dir, '.hidden'));
    writeFileSync(join(dir, '.hidden', 'x.yaml'), TASK_B_NO_REF);
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'node_modules', 'y.yaml'), TASK_B_NO_REF);
    try {
      symlinkSync(dir, join(dir, 'loop'));
    } catch {
      /* symlink not permitted; the rest of the assertions still hold */
    }
    const reg = await loadDirectory(dir);
    expect(reg.tasks.size).toBe(1);
    expect(reg.tasks.has('task-a')).toBe(true);
  });

  it('reports duplicate ids as error issues, keeps first occurrence', async () => {
    mkdirSync(join(dir, 'a'));
    mkdirSync(join(dir, 'b'));
    writeFileSync(join(dir, 'a', 't.yaml'), TASK_A);
    writeFileSync(join(dir, 'b', 't.yaml'), TASK_A);
    const reg = await loadDirectory(dir);
    expect(reg.tasks.size).toBe(1);
    expect(reg.issues.some((i) => /duplicate Task id/.test(i.message))).toBe(true);
  });

  it('captures parse errors per file without aborting', async () => {
    writeFileSync(join(dir, 'good.yaml'), TASK_A);
    writeFileSync(join(dir, 'bad.yaml'), 'schemaVersion: 1\nkind: Task\nmetadata: {}\nspec: {}\n');
    const reg = await loadDirectory(dir);
    expect(reg.tasks.has('task-a')).toBe(true);
    expect(reg.issues.length).toBeGreaterThan(0);
  });

  it('rejects too many files via maxFiles', async () => {
    writeFileSync(join(dir, 't.yaml'), TASK_A);
    const reg = await loadDirectory(dir, { safety: { maxFiles: 0 } });
    expect(reg.issues.some((i) => /too many files/.test(i.message))).toBe(true);
    expect(reg.tasks.size).toBe(0);
  });

  it('honors injected listFiles', async () => {
    writeFileSync(join(dir, 'a.yaml'), TASK_A);
    writeFileSync(join(dir, 'b.yaml'), TEMPLATE_1);
    const reg = await loadDirectory(dir, { listFiles: async () => ['a.yaml'] });
    expect(reg.tasks.size).toBe(1);
    expect(reg.templates.size).toBe(0);
  });
});

describe('serialization · loader · resolveReferences', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yclaw-refs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes when all templateRefs exist', async () => {
    writeFileSync(join(dir, 'task.yaml'), TASK_A);
    writeFileSync(join(dir, 'tmpl.yaml'), TEMPLATE_1);
    const reg = await loadDirectory(dir);
    const refs = resolveReferences(reg);
    expect(refs.ok).toBe(true);
    expect(refs.issues).toHaveLength(0);
  });

  it('flags unresolved templateRef', async () => {
    writeFileSync(join(dir, 'task.yaml'), TASK_A);
    // template missing
    const reg = await loadDirectory(dir);
    const refs = resolveReferences(reg);
    expect(refs.ok).toBe(false);
    expect(refs.issues[0]!.message).toMatch(/unresolved templateRef "tmpl-1"/);
  });

  it('ignores tasks without templateRef', async () => {
    writeFileSync(join(dir, 'task.yaml'), TASK_B_NO_REF);
    const reg = await loadDirectory(dir);
    expect(resolveReferences(reg).ok).toBe(true);
  });
});
