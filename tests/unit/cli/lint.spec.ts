import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

const VALID = `
schemaVersion: 1
kind: Task
metadata:
  id: t1
  name: T
spec:
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#a' }
`;

const INVALID = `
schemaVersion: 1
kind: Task
metadata:
  id: '!!!'
  name: ''
spec:
  steps: []
`;

const SYNTAX_ERROR = `
schemaVersion: 1
kind: Task
metadata:
  id: t1
   name: bad-indent
`;

describe('cli · lint', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yclaw-lint-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns exit 0 on a valid file', async () => {
    const file = join(dir, 'task.yaml');
    writeFileSync(file, VALID);
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runLint({ inputs: [file], stdout, stderr, cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(r.errorCount).toBe(0);
    expect(stdout.text()).toMatch(/ok\s+task\.yaml/);
  });

  it('returns exit 1 on schema-invalid file (text format)', async () => {
    const file = join(dir, 'bad.yaml');
    writeFileSync(file, INVALID);
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runLint({ inputs: [file], stdout, stderr, cwd: dir });
    expect(r.exitCode).toBe(1);
    expect(r.errorCount).toBeGreaterThan(0);
    const out = stdout.text();
    expect(out).toMatch(/✖\s+bad\.yaml/);
    expect(out).toMatch(/error/);
  });

  it('returns exit 1 on YAML syntax error', async () => {
    const file = join(dir, 'broken.yaml');
    writeFileSync(file, SYNTAX_ERROR);
    const stdout = new StringSink();
    const r = await runLint({ inputs: [file], stdout, stderr: new StringSink(), cwd: dir });
    expect(r.exitCode).toBe(1);
    expect(stdout.text()).toMatch(/parse error|YAML/i);
  });

  it('walks directories recursively, ignores non-yaml', async () => {
    writeFileSync(join(dir, 'a.yaml'), VALID);
    writeFileSync(join(dir, 'README.md'), '# hi');
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'b.yml'), VALID);
    const stdout = new StringSink();
    const r = await runLint({ inputs: [dir], stdout, stderr: new StringSink(), cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(r.files).toHaveLength(2);
  });

  it('skips dot-directories and node_modules', async () => {
    mkdirSync(join(dir, '.hidden'));
    writeFileSync(join(dir, '.hidden', 'x.yaml'), INVALID);
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'node_modules', 'y.yaml'), INVALID);
    writeFileSync(join(dir, 'real.yaml'), VALID);
    const r = await runLint({ inputs: [dir], stdout: new StringSink(), stderr: new StringSink(), cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(r.files).toHaveLength(1);
  });

  it('emits valid JSON when format=json', async () => {
    const file = join(dir, 't.yaml');
    writeFileSync(file, INVALID);
    const stdout = new StringSink();
    const r = await runLint({ inputs: [file], format: 'json', stdout, stderr: new StringSink(), cwd: dir });
    expect(r.exitCode).toBe(1);
    const parsed = JSON.parse(stdout.text());
    expect(parsed.errorCount).toBeGreaterThan(0);
    expect(Array.isArray(parsed.files)).toBe(true);
    expect(parsed.files[0].issues.length).toBeGreaterThan(0);
  });

  it('emits valid SARIF 2.1.0 when format=sarif', async () => {
    const file = join(dir, 't.yaml');
    writeFileSync(file, INVALID);
    const stdout = new StringSink();
    const r = await runLint({ inputs: [file], format: 'sarif', stdout, stderr: new StringSink(), cwd: dir });
    expect(r.exitCode).toBe(1);
    const sarif = JSON.parse(stdout.text());
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe('yclaw-lint');
    expect(Array.isArray(sarif.runs[0].results)).toBe(true);
    expect(sarif.runs[0].results.length).toBeGreaterThan(0);
    const first = sarif.runs[0].results[0];
    expect(['error', 'warning']).toContain(first.level);
    expect(typeof first.message.text).toBe('string');
    expect(first.locations[0].physicalLocation.artifactLocation.uri).toMatch(/t\.yaml$/);
    // 规则被收集到 driver.rules 中
    expect(Array.isArray(sarif.runs[0].tool.driver.rules)).toBe(true);
    expect(sarif.runs[0].tool.driver.rules.length).toBeGreaterThan(0);
  });

  it('SARIF emits empty results array when all files pass', async () => {
    const file = join(dir, 'ok.yaml');
    writeFileSync(file, VALID);
    const stdout = new StringSink();
    const r = await runLint({ inputs: [file], format: 'sarif', stdout, stderr: new StringSink(), cwd: dir });
    expect(r.exitCode).toBe(0);
    const sarif = JSON.parse(stdout.text());
    expect(sarif.runs[0].results).toEqual([]);
  });

  it('SARIF ruleId is sanitized to safe characters [A-Za-z0-9._-]', async () => {
    const file = join(dir, 't.yaml');
    writeFileSync(file, INVALID);
    const stdout = new StringSink();
    await runLint({ inputs: [file], format: 'sarif', stdout, stderr: new StringSink(), cwd: dir });
    const sarif = JSON.parse(stdout.text());
    for (const rule of sarif.runs[0].tool.driver.rules as Array<{ id: string }>) {
      expect(rule.id).toMatch(/^tac\.[A-Za-z0-9._-]+$/);
    }
    for (const r of sarif.runs[0].results as Array<{ ruleId: string }>) {
      expect(r.ruleId).toMatch(/^tac\.[A-Za-z0-9._-]+$/);
    }
  });

  it('strict mode turns warnings into failure', async () => {
    // 空 steps 数组是 warning
    const file = join(dir, 'warn.yaml');
    writeFileSync(
      file,
      `
schemaVersion: 1
kind: Task
metadata: { id: t, name: T }
spec: { steps: [] }
`,
    );
    const lax = await runLint({ inputs: [file], stdout: new StringSink(), stderr: new StringSink(), cwd: dir });
    expect(lax.exitCode).toBe(0);
    expect(lax.warningCount).toBeGreaterThan(0);
    const strict = await runLint({
      inputs: [file],
      strict: true,
      stdout: new StringSink(),
      stderr: new StringSink(),
      cwd: dir,
    });
    expect(strict.exitCode).toBe(1);
  });

  it('exit 2 when no inputs given', async () => {
    const stderr = new StringSink();
    const r = await runLint({ inputs: [], stdout: new StringSink(), stderr, cwd: dir });
    expect(r.exitCode).toBe(2);
    expect(stderr.text()).toMatch(/no input/);
  });

  it('exit 2 when no yaml files found in dir', async () => {
    writeFileSync(join(dir, 'README.md'), '# x');
    const stderr = new StringSink();
    const r = await runLint({ inputs: [dir], stdout: new StringSink(), stderr, cwd: dir });
    expect(r.exitCode).toBe(2);
    expect(stderr.text()).toMatch(/no \.yaml/);
  });

  it('exit 2 when input path does not exist', async () => {
    const stderr = new StringSink();
    const r = await runLint({
      inputs: [join(dir, 'missing.yaml')],
      stdout: new StringSink(),
      stderr,
      cwd: dir,
    });
    expect(r.exitCode).toBe(2);
    expect(stderr.text()).toMatch(/yclaw lint:/);
  });
});
