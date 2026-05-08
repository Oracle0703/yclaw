import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLint } from '@cli/lint';

class StringSink {
  chunks: string[] = [];
  write(c: string): void {
    this.chunks.push(c);
  }
  text(): string {
    return this.chunks.join('');
  }
}

const TASK_WITH_REF = `
schemaVersion: 1
kind: Task
metadata: { id: t, name: T }
spec:
  templateRef: missing-template
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#a' }
`;

const TASK_NO_REF = `
schemaVersion: 1
kind: Task
metadata: { id: t, name: T }
spec:
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#a' }
`;

const TEMPLATE = `
schemaVersion: 1
kind: Template
metadata: { id: missing-template, name: M }
spec:
  fields:
    - { name: x, selector: '#x', attribute: text }
`;

describe('cli · lint · --check-refs', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yclaw-lint-refs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('without flag: ignores unresolved templateRef', async () => {
    writeFileSync(join(dir, 't.yaml'), TASK_WITH_REF);
    const r = await runLint({ inputs: [dir], stdout: new StringSink(), stderr: new StringSink(), cwd: dir });
    expect(r.exitCode).toBe(0);
  });

  it('with flag: fails on unresolved templateRef', async () => {
    writeFileSync(join(dir, 't.yaml'), TASK_WITH_REF);
    const stdout = new StringSink();
    const r = await runLint({
      inputs: [dir],
      checkRefs: true,
      stdout,
      stderr: new StringSink(),
      cwd: dir,
    });
    expect(r.exitCode).toBe(1);
    expect(stdout.text()).toMatch(/cross-file references/);
    expect(stdout.text()).toMatch(/unresolved templateRef/);
  });

  it('with flag: passes when ref is resolvable', async () => {
    writeFileSync(join(dir, 't.yaml'), TASK_WITH_REF);
    writeFileSync(join(dir, 'tmpl.yaml'), TEMPLATE);
    const r = await runLint({
      inputs: [dir],
      checkRefs: true,
      stdout: new StringSink(),
      stderr: new StringSink(),
      cwd: dir,
    });
    expect(r.exitCode).toBe(0);
  });

  it('with flag on single file: skips ref check (only dirs trigger it)', async () => {
    const f = join(dir, 't.yaml');
    writeFileSync(f, TASK_WITH_REF);
    const r = await runLint({
      inputs: [f],
      checkRefs: true,
      stdout: new StringSink(),
      stderr: new StringSink(),
      cwd: dir,
    });
    expect(r.exitCode).toBe(0);
  });

  it('json output includes refIssues array', async () => {
    writeFileSync(join(dir, 't.yaml'), TASK_NO_REF);
    const stdout = new StringSink();
    await runLint({
      inputs: [dir],
      checkRefs: true,
      format: 'json',
      stdout,
      stderr: new StringSink(),
      cwd: dir,
    });
    const parsed = JSON.parse(stdout.text());
    expect(Array.isArray(parsed.refIssues)).toBe(true);
  });
});
