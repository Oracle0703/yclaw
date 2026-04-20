import { describe, expect, it, vi } from 'vitest';
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

  it('shows help for mcp serve --help', async () => {
    const stdout = new StringSink();
    const code = await runCli({
      argv: ['mcp', 'serve', '--help'],
      stdout,
      stderr: new StringSink(),
    });
    expect(code).toBe(0);
    expect(stdout.text()).toMatch(/mcp serve/i);
    expect(stdout.text()).toMatch(/--transport/);
  });

  it('dispatches mcp serve to injected handler', async () => {
    const stdout = new StringSink();
    const code = await runCli({
      argv: ['mcp', 'serve', '--transport', 'stdio'],
      stdout,
      stderr: new StringSink(),
      mcpServe: async (args) => {
        stdout.write(JSON.stringify(args));
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(stdout.text()).toContain('"transport":"stdio"');
  });

  it('rejects unsupported mcp transport', async () => {
    const stderr = new StringSink();
    const code = await runCli({
      argv: ['mcp', 'serve', '--transport', 'ws'],
      stdout: new StringSink(),
      stderr,
    });
    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/transport/i);
  });

  it('dispatches list tasks to injected runner handler as json', async () => {
    const stdout = new StringSink();
    const runnerList = vi.fn(async () => ({
      exitCode: 0,
      output: JSON.stringify([{ id: 'task-1', name: '采集任务', status: 'idle' }]),
    }));

    const code = await runCli({
      argv: ['list', 'tasks', '--output', 'json'],
      stdout,
      stderr: new StringSink(),
      runnerList,
    });

    expect(code).toBe(0);
    expect(runnerList).toHaveBeenCalledWith({
      target: 'tasks',
      output: 'json',
      taskId: undefined,
      limit: undefined,
    });
    expect(JSON.parse(stdout.text())).toEqual([
      { id: 'task-1', name: '采集任务', status: 'idle' },
    ]);
  });

  it('dispatches list batches with task and limit to injected runner handler', async () => {
    const stdout = new StringSink();
    const runnerList = vi.fn(async () => ({
      exitCode: 0,
      output: 'batch-1\tsuccess\t2026-04-20T00:00:00.000Z',
    }));

    const code = await runCli({
      argv: ['list', 'batches', '--task', 'task-1', '--limit', '1'],
      stdout,
      stderr: new StringSink(),
      runnerList,
    });

    expect(code).toBe(0);
    expect(runnerList).toHaveBeenCalledWith({
      target: 'batches',
      output: 'text',
      taskId: 'task-1',
      limit: 1,
    });
    expect(stdout.text()).toContain('batch-1');
  });

  it('requires --task for list batches', async () => {
    const stderr = new StringSink();
    const code = await runCli({
      argv: ['list', 'batches'],
      stdout: new StringSink(),
      stderr,
    });

    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/--task/);
  });

  it('dispatches run to injected runner handler as json', async () => {
    const stdout = new StringSink();
    const runnerRun = vi.fn(async () => ({
      exitCode: 0,
      output: JSON.stringify({ taskId: 'task-1', batchId: 'batch-1', status: 'completed' }),
    }));

    const code = await runCli({
      argv: ['run', 'task-1', '--output', 'json'],
      stdout,
      stderr: new StringSink(),
      runnerRun,
    });

    expect(code).toBe(0);
    expect(runnerRun).toHaveBeenCalledWith({
      taskId: 'task-1',
      output: 'json',
    });
    expect(JSON.parse(stdout.text())).toMatchObject({ batchId: 'batch-1' });
  });

  it('dispatches run --headed to injected runner handler', async () => {
    const runnerRun = vi.fn(async () => ({
      exitCode: 0,
      output: 'task-1\tbatch-1\tcompleted',
    }));

    const code = await runCli({
      argv: ['run', 'task-1', '--headed'],
      stdout: new StringSink(),
      stderr: new StringSink(),
      runnerRun,
    });

    expect(code).toBe(0);
    expect(runnerRun).toHaveBeenCalledWith({
      taskId: 'task-1',
      output: 'text',
      headed: true,
    });
  });

  it('dispatches run --browser-executable to injected runner handler', async () => {
    const runnerRun = vi.fn(async () => ({
      exitCode: 0,
      output: 'task-1\tbatch-1\tcompleted',
    }));

    const code = await runCli({
      argv: ['run', 'task-1', '--browser-executable', 'C:\\Browser\\chrome.exe'],
      stdout: new StringSink(),
      stderr: new StringSink(),
      runnerRun,
    });

    expect(code).toBe(0);
    expect(runnerRun).toHaveBeenCalledWith({
      taskId: 'task-1',
      output: 'text',
      browserExecutable: 'C:\\Browser\\chrome.exe',
    });
  });

  it('requires task id for run', async () => {
    const stderr = new StringSink();
    const code = await runCli({
      argv: ['run'],
      stdout: new StringSink(),
      stderr,
    });

    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/task/i);
  });
});
