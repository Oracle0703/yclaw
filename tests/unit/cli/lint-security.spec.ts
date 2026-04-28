import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLint, SAFETY } from '@cli/lint';

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

describe('cli · lint · security', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yclaw-sec-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects symlink as input (exit 2)', async () => {
    const real = join(dir, 'real.yaml');
    writeFileSync(real, VALID);
    const link = join(dir, 'link.yaml');
    try {
      symlinkSync(real, link);
    } catch {
      return; /* skip when symlink not permitted */
    }
    const stderr = new StringSink();
    const r = await runLint({ inputs: [link], stdout: new StringSink(), stderr, cwd: dir });
    expect(r.exitCode).toBe(2);
    expect(stderr.text()).toMatch(/symlink/i);
  });

  it('skips symlinks when walking directory', async () => {
    writeFileSync(join(dir, 'a.yaml'), VALID);
    // 一个指向自己父目录的环形 symlink；如果 walk 跟随会爆栈
    try {
      symlinkSync(dir, join(dir, 'loop'));
    } catch {
      return; /* skip when symlink not permitted */
    }
    const r = await runLint({
      inputs: [dir],
      stdout: new StringSink(),
      stderr: new StringSink(),
      cwd: dir,
    });
    expect(r.exitCode).toBe(0);
    expect(r.files).toHaveLength(1);
  });

  it('refuses files exceeding maxFileSize', async () => {
    const file = join(dir, 'huge.yaml');
    // 一个超过上限的「合法」头加大量内容
    const padding = '# pad\n'.repeat(Math.ceil(SAFETY.maxFileSize / 6) + 1);
    writeFileSync(file, padding);
    const r = await runLint({
      inputs: [file],
      stdout: new StringSink(),
      stderr: new StringSink(),
      cwd: dir,
    });
    expect(r.exitCode).toBe(1);
    expect(r.files[0]!.issues[0]!.message).toMatch(/file size .* exceeds limit/);
  });

  it('refuses dir exceeding maxDirDepth', async () => {
    let cur = dir;
    for (let i = 0; i <= SAFETY.maxDirDepth + 1; i += 1) {
      cur = join(cur, `d${i}`);
      mkdirSync(cur);
    }
    writeFileSync(join(cur, 'deep.yaml'), VALID);
    const stderr = new StringSink();
    const r = await runLint({ inputs: [dir], stdout: new StringSink(), stderr, cwd: dir });
    expect(r.exitCode).toBe(2);
    expect(stderr.text()).toMatch(/depth exceeds/);
  });
});
