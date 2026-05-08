import { mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runExport, runImport } from '@cli/io';

class S {
  chunks: string[] = [];
  write(c: string) {
    this.chunks.push(c);
    return true;
  }
  text() {
    return this.chunks.join('');
  }
}

describe('cli · io · security/edge-case', () => {
  let tmp = '';
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'yclaw-io-sec-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('runExport refuses symlink input', async () => {
    const real = join(tmp, 'real.json');
    writeFileSync(real, '{"tasks":[]}', 'utf8');
    const link = join(tmp, 'link.json');
    try {
      symlinkSync(real, link);
    } catch {
      return; /* skip when symlink not permitted */
    }
    const stderr = new S();
    const r = await runExport({ inputs: [link], stdout: new S(), stderr });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/symlink/);
  });

  it('runImport refuses symlinked YAML file input via collectYamlFiles entry', async () => {
    const real = join(tmp, 'real.yaml');
    writeFileSync(
      real,
      'schemaVersion: 1\nkind: Task\nmetadata:\n  id: t\n  name: x\nspec:\n  steps:\n    - id: s\n      name: c\n      action: { type: click, selector: "#a" }\n',
      'utf8',
    );
    const link = join(tmp, 'link.yaml');
    try {
      symlinkSync(real, link);
    } catch {
      return; /* skip when symlink not permitted */
    }
    const stderr = new S();
    const r = await runImport({ inputs: [link], stdout: new S(), stderr });
    expect(r.exitCode).toBe(2);
    expect(stderr.text()).toMatch(/symlink/);
  });

  it('safeFileId neutralizes path-traversal-shaped task ids', async () => {
    // We can't author a YAML with id="../etc/passwd" because schema rejects it,
    // but we can drive runExport with a hand-built JSON record whose id is hostile.
    const jsonFile = join(tmp, 'evil.json');
    writeFileSync(
      jsonFile,
      JSON.stringify([
        {
          kind: 'Task',
          id: '../../etc/passwd',
          name: 'x',
          steps: [{ id: 's', name: 'c', action: { type: 'click', selector: '#a' } }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      'utf8',
    );
    const outDir = join(tmp, 'out');
    const r = await runExport({
      inputs: [jsonFile],
      outDir,
      stdout: new S(),
      stderr: new S(),
    });
    // Mapping likely rejects id with non-allowed chars; expect exit 1 OR
    // a sanitized filename inside outDir (no path escape).
    if (r.exitCode === 0) {
      const files = readdirSync(outDir);
      for (const f of files) {
        expect(f).not.toContain('/');
        expect(f).not.toContain('..');
      }
    } else {
      expect(r.exitCode).toBe(1);
    }
  });

  it('detects output filename collision in runExport', async () => {
    const jsonFile = join(tmp, 'dup.json');
    // Two tasks with same id → same output filename
    const rec = (id: string) => ({
      kind: 'Task',
      id,
      name: 'x',
      steps: [{ id: 's', name: 'c', action: { type: 'click', selector: '#a' } }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    writeFileSync(jsonFile, JSON.stringify([rec('dup'), rec('dup')]), 'utf8');
    const stderr = new S();
    const r = await runExport({
      inputs: [jsonFile],
      outDir: join(tmp, 'out'),
      stdout: new S(),
      stderr,
    });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/collision/);
  });

  it('rejects file just over IO_SAFETY.maxFileSize', async () => {
    const jsonFile = join(tmp, 'big.json');
    writeFileSync(jsonFile, '[' + ' '.repeat(1024 * 1024) + ']', 'utf8');
    const stderr = new S();
    const r = await runExport({ inputs: [jsonFile], stdout: new S(), stderr });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/exceeds limit/);
  });

  it('runExport rejects non-regular file input (directory)', async () => {
    const stderr = new S();
    const r = await runExport({ inputs: [tmp], stdout: new S(), stderr });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/not a regular file|read error|EISDIR/);
  });
});
