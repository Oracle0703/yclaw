import { describe, expect, it } from 'vitest';
import { runCli } from '@cli/yclaw';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
metadata: { id: t, name: T }
spec:
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#a' }
`;

describe('cli · yclaw entry', () => {
  it('shows help with no args (exit 2)', async () => {
    const stdout = new StringSink();
    const code = await runCli({ argv: [], stdout, stderr: new StringSink() });
    expect(code).toBe(2);
    expect(stdout.text()).toMatch(/Usage:/);
  });

  it('shows help with --help (exit 0)', async () => {
    const stdout = new StringSink();
    const code = await runCli({ argv: ['--help'], stdout, stderr: new StringSink() });
    expect(code).toBe(0);
    expect(stdout.text()).toMatch(/Usage:/);
  });

  it('rejects unknown command (exit 2)', async () => {
    const stderr = new StringSink();
    const code = await runCli({ argv: ['nope'], stdout: new StringSink(), stderr });
    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/unknown command/);
  });

  it('dispatches to lint and returns 0 on valid file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yclaw-cli-'));
    try {
      const file = join(dir, 't.yaml');
      writeFileSync(file, VALID);
      const code = await runCli({
        argv: ['lint', file, '--format', 'json'],
        stdout: new StringSink(),
        stderr: new StringSink(),
        cwd: dir,
      });
      expect(code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects invalid --format value', async () => {
    const stderr = new StringSink();
    const code = await runCli({
      argv: ['lint', 'somewhere', '--format', 'xml'],
      stdout: new StringSink(),
      stderr,
    });
    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/--format/);
  });

  it('supports --format=value form', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yclaw-cli-'));
    try {
      writeFileSync(join(dir, 'a.yaml'), VALID);
      const stdout = new StringSink();
      const code = await runCli({
        argv: ['lint', dir, '--format=json'],
        stdout,
        stderr: new StringSink(),
        cwd: dir,
      });
      expect(code).toBe(0);
      expect(() => JSON.parse(stdout.text())).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects unknown options', async () => {
    const stderr = new StringSink();
    const code = await runCli({
      argv: ['lint', '--bogus'],
      stdout: new StringSink(),
      stderr,
    });
    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/unknown option/);
  });
});
