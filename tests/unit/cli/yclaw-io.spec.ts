import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '@cli/yclaw';

class S {
  chunks: string[] = [];
  write(c: string) { this.chunks.push(c); return true; }
  text() { return this.chunks.join(''); }
}

const TASK_YAML = [
  'schemaVersion: 1',
  'kind: Task',
  'metadata:',
  '  id: t1',
  '  name: T',
  'spec:',
  '  steps:',
  "    - id: s1",
  '      name: c',
  "      action: { type: click, selector: '#a' }",
  '',
].join('\n');

describe('cli · yclaw import/export argv', () => {
  let tmp = '';
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'yclaw-cli-io-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('--help mentions import and export commands', async () => {
    const stdout = new S();
    const code = await runCli({ argv: ['--help'], stdout, stderr: new S() });
    expect(code).toBe(0);
    const text = stdout.text();
    expect(text).toMatch(/yclaw import/);
    expect(text).toMatch(/yclaw export/);
  });

  it('import writes JSON files with --out', async () => {
    const yamlFile = join(tmp, 'a.yaml');
    writeFileSync(yamlFile, TASK_YAML, 'utf8');
    const out = join(tmp, 'out');
    const code = await runCli({
      argv: ['import', yamlFile, '--out', out],
      stdout: new S(),
      stderr: new S(),
    });
    expect(code).toBe(0);
    const files = readdirSync(out);
    expect(files).toEqual(['t1.task.json']);
  });

  it('import accepts --out=<dir>', async () => {
    const yamlFile = join(tmp, 'a.yaml');
    writeFileSync(yamlFile, TASK_YAML, 'utf8');
    const out = join(tmp, 'out2');
    const code = await runCli({
      argv: ['import', `--out=${out}`, yamlFile],
      stdout: new S(),
      stderr: new S(),
    });
    expect(code).toBe(0);
    expect(readdirSync(out)).toContain('t1.task.json');
  });

  it('import returns 2 when --out has no value', async () => {
    const stderr = new S();
    const code = await runCli({
      argv: ['import', 'somefile.yaml', '--out'],
      stdout: new S(),
      stderr,
    });
    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/--out requires/);
  });

  it('import rejects unknown options', async () => {
    const stderr = new S();
    const code = await runCli({
      argv: ['import', '--bogus', 'x.yaml'],
      stdout: new S(),
      stderr,
    });
    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/unknown option/);
  });

  it('export round-trips a single JSON record to YAML stdout', async () => {
    const jsonFile = join(tmp, 'in.json');
    writeFileSync(
      jsonFile,
      JSON.stringify({
        kind: 'Task',
        id: 'x1',
        name: 'X',
        steps: [{ id: 's', name: 'c', action: { type: 'click', selector: '#a' } }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      'utf8',
    );
    const stdout = new S();
    const code = await runCli({ argv: ['export', jsonFile], stdout, stderr: new S() });
    expect(code).toBe(0);
    expect(stdout.text()).toMatch(/kind: Task/);
    expect(stdout.text()).toMatch(/id: x1/);
  });

  it('export writes YAML files with --out', async () => {
    const jsonFile = join(tmp, 'in.json');
    writeFileSync(
      jsonFile,
      JSON.stringify([
        {
          kind: 'Task',
          id: 'x1',
          name: 'X',
          steps: [{ id: 's', name: 'c', action: { type: 'click', selector: '#a' } }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      'utf8',
    );
    const out = join(tmp, 'yaml-out');
    const code = await runCli({
      argv: ['export', jsonFile, '--out', out],
      stdout: new S(),
      stderr: new S(),
    });
    expect(code).toBe(0);
    expect(readdirSync(out)).toEqual(['x1.yaml']);
    expect(readFileSync(join(out, 'x1.yaml'), 'utf8')).toMatch(/id: x1/);
  });

  it('export rejects unknown options', async () => {
    const stderr = new S();
    const code = await runCli({
      argv: ['export', '--whatever', 'x.json'],
      stdout: new S(),
      stderr,
    });
    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/unknown option/);
  });
});
