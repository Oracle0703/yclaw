import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDirectory } from '@shared/serialization';

const TASK = `
schemaVersion: 1
kind: Task
metadata: { id: t, name: T }
spec:
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#a' }
`;

describe('serialization · loader · security', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yclaw-loader-sec-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('refuses symlink as rootDir', async () => {
    const real = join(dir, 'real');
    mkdirSync(real);
    writeFileSync(join(real, 't.yaml'), TASK);
    const link = join(dir, 'link');
    symlinkSync(real, link);
    const reg = await loadDirectory(link);
    expect(reg.tasks.size).toBe(0);
    expect(reg.issues.some((i) => /symlink root/.test(i.message))).toBe(true);
  });

  it('reports clear issue when root is missing', async () => {
    const reg = await loadDirectory(join(dir, 'nope'));
    expect(reg.tasks.size).toBe(0);
    expect(reg.issues.some((i) => /cannot stat root/.test(i.message))).toBe(true);
  });

  it('reports clear issue when root is a regular file', async () => {
    const f = join(dir, 'file.yaml');
    writeFileSync(f, TASK);
    const reg = await loadDirectory(f);
    expect(reg.issues.some((i) => /not a directory/.test(i.message))).toBe(true);
  });

  it('rejects injected paths that escape rootDir', async () => {
    writeFileSync(join(dir, 'a.yaml'), TASK);
    const reg = await loadDirectory(dir, {
      listFiles: async () => ['../../../etc/passwd', 'a.yaml'],
    });
    // 越界路径被拒，但合法的 a.yaml 仍被加载
    expect(reg.tasks.size).toBe(1);
    expect(reg.issues.some((i) => /escapes rootDir/.test(i.message))).toBe(true);
  });

  it('accepts injected paths inside rootDir', async () => {
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'a.yaml'), TASK);
    const reg = await loadDirectory(dir, {
      listFiles: async () => ['sub/a.yaml'],
    });
    expect(reg.tasks.size).toBe(1);
    expect(reg.issues).toHaveLength(0);
  });
});
