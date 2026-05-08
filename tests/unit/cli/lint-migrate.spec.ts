import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '@cli/yclaw';

class StringSink {
  chunks: string[] = [];
  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
  text(): string {
    return this.chunks.join('');
  }
}

describe('cli · yclaw lint --migrate', () => {
  let tmp = '';
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'yclaw-cli-mig-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function makeV0(name: string): string {
    const file = join(tmp, name);
    writeFileSync(
      file,
      [
        'schemaVersion: 0',
        'kind: Task',
        'metadata:',
        '  id: t1',
        '  title: 旧任务',
        'spec:',
        '  steps:',
        "    - id: s1",
        "      name: c",
        "      action: { type: click, selector: '#a' }",
        '',
      ].join('\n'),
      'utf8',
    );
    return file;
  }

  it('without --migrate, v0 file fails lint', async () => {
    const file = makeV0('legacy.yaml');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const code = await runCli({ argv: ['lint', file], stdout, stderr });
    expect(code).toBe(1);
    expect(stdout.text()).toMatch(/Unsupported schemaVersion|schemaVersion/);
  });

  it('with --migrate, v0 file passes lint', async () => {
    const file = makeV0('legacy.yaml');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const code = await runCli({ argv: ['lint', '--migrate', file], stdout, stderr });
    expect(code).toBe(0);
    expect(stdout.text()).toMatch(/0 error\(s\)/);
  });

  it('--migrate is shown in --help', async () => {
    const stdout = new StringSink();
    const stderr = new StringSink();
    await runCli({ argv: ['--help'], stdout, stderr });
    expect(stdout.text()).toMatch(/--migrate/);
  });

  it('with --migrate + --format json, output validates clean', async () => {
    const file = makeV0('legacy.yaml');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const code = await runCli({
      argv: ['lint', '--migrate', '--format', 'json', file],
      stdout,
      stderr,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.text());
    expect(parsed.errorCount).toBe(0);
    expect(parsed.files[0].issues).toEqual([]);
  });
});
