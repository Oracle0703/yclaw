import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeStream extends EventEmitter {
  emitData(text: string): void {
    this.emit('data', Buffer.from(text));
  }
}

class FakeChildProcess extends EventEmitter {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  killed = false;
  kill = vi.fn((signal?: string) => {
    this.killed = true;
    this.emit('exit', null, signal);
    return true;
  });
}

describe('scripts/dev.ts', () => {
  const spawned: Array<{ command: string; args: string[]; process: FakeChildProcess }> = [];
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.resetModules();
    spawned.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('等待 main watch ready 后启动 Electron，并在主进程重新编译完成后重启', async () => {
    vi.useFakeTimers();
    vi.doMock('child_process', () => ({
      spawn: vi.fn((command: string, args: string[]) => {
        const child = new FakeChildProcess();
        spawned.push({ command, args, process: child });
        return child;
      }),
    }));

    await import('../../../scripts/dev.ts');

    expect(spawned).toHaveLength(3);
    expect(spawned[0]?.command).toContain('vite');
    expect(spawned[1]?.command).toContain('tsc');
    expect(spawned[2]?.args).toEqual([
      '-p',
      'tsconfig.main.json',
      '--watch',
      '--preserveWatchOutput',
    ]);

    spawned[0]?.process.stdout.emitData('  Local:   http://localhost:5174/\n');
    spawned[1]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');

    expect(spawned).toHaveLength(3);

    spawned[2]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');

    await vi.runAllTimersAsync();

    expect(spawned).toHaveLength(4);
    expect(spawned[3]?.command).toContain('electron');
    expect(spawned[3]?.args).toEqual(['src/main/index.ts']);

    const firstElectron = spawned[3]?.process;

    spawned[2]?.process.stdout.emitData(
      'File change detected. Starting incremental compilation...\n',
    );
    spawned[2]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');

    await vi.runAllTimersAsync();

    expect(firstElectron?.kill).toHaveBeenCalledWith('SIGTERM');
    expect(spawned).toHaveLength(5);
    expect(spawned[4]?.command).toContain('electron');

    vi.useRealTimers();
  });
});
