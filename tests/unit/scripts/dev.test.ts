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
  const ensureElectronNativeDepsMock = vi.fn();
  const spawnSyncMock = vi.fn(() => ({ status: 0, stdout: '' }));
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.resetModules();
    spawned.length = 0;
    ensureElectronNativeDepsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('等待 main watch ready 后启动 Electron，并在主进程重新编译完成后重启', async () => {
    vi.useFakeTimers();
    vi.doMock('../../../scripts/ensure-electron-native-deps', () => ({
      ensureElectronNativeDeps: ensureElectronNativeDepsMock,
    }));
    vi.doMock('child_process', () => ({
      spawn: vi.fn((command: string, args: string[]) => {
        const child = new FakeChildProcess();
        spawned.push({ command, args, process: child });
        return child;
      }),
      spawnSync: spawnSyncMock,
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
    expect(ensureElectronNativeDepsMock).toHaveBeenCalledTimes(1);
    const powershellCall = spawnSyncMock.mock.calls.find((call) => call[0] === 'powershell');
    expect((powershellCall?.[1] as string[] | undefined)?.[2]).toContain(
      String.raw`e:\allsite\yclaw`,
    );
    expect((powershellCall?.[1] as string[] | undefined)?.[2]).not.toContain(
      String.raw`e:\\allsite\\yclaw`,
    );

    const firstElectron = spawned[3]?.process;

    spawned[2]?.process.stdout.emitData(
      'File change detected. Starting incremental compilation...\n',
    );
    spawned[2]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');

    await vi.runAllTimersAsync();

    expect(firstElectron?.kill).toHaveBeenCalledWith('SIGTERM');
    expect(spawned).toHaveLength(5);
    expect(spawned[4]?.command).toContain('electron');
    expect(ensureElectronNativeDepsMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('热重载主动结束旧 Electron 时不把 Windows code 1 记成错误', async () => {
    vi.useFakeTimers();
    vi.doMock('../../../scripts/ensure-electron-native-deps', () => ({
      ensureElectronNativeDeps: ensureElectronNativeDepsMock,
    }));
    vi.doMock('child_process', () => ({
      spawn: vi.fn((command: string, args: string[]) => {
        const child = new FakeChildProcess();
        spawned.push({ command, args, process: child });
        return child;
      }),
      spawnSync: spawnSyncMock,
    }));

    await import('../../../scripts/dev.ts');

    spawned[0]?.process.stdout.emitData('  Local:   http://localhost:5174/\n');
    spawned[1]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');
    spawned[2]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');

    await vi.runAllTimersAsync();

    const firstElectron = spawned[3]?.process;
    firstElectron?.kill.mockImplementation(() => {
      firstElectron.killed = true;
      firstElectron.emit('exit', 1, null);
      return true;
    });

    spawned[2]?.process.stdout.emitData(
      'File change detected. Starting incremental compilation...\n',
    );
    spawned[2]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');

    await vi.runAllTimersAsync();

    expect(console.error).not.toHaveBeenCalledWith('[electron] exited with code 1');
    expect(spawned).toHaveLength(5);

    vi.useRealTimers();
  });

  it('Electron 非预期退出后自动重新拉起，避免热重载停住', async () => {
    vi.useFakeTimers();
    vi.doMock('../../../scripts/ensure-electron-native-deps', () => ({
      ensureElectronNativeDeps: ensureElectronNativeDepsMock,
    }));
    vi.doMock('child_process', () => ({
      spawn: vi.fn((command: string, args: string[]) => {
        const child = new FakeChildProcess();
        spawned.push({ command, args, process: child });
        return child;
      }),
      spawnSync: spawnSyncMock,
    }));

    await import('../../../scripts/dev.ts');

    spawned[0]?.process.stdout.emitData('  Local:   http://localhost:5174/\n');
    spawned[1]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');
    spawned[2]?.process.stdout.emitData('Found 0 errors. Watching for file changes.\n');

    await vi.runAllTimersAsync();

    expect(spawned).toHaveLength(4);
    const firstElectron = spawned[3]?.process;

    firstElectron?.emit('exit', 1, null);

    await vi.runAllTimersAsync();

    expect(console.error).toHaveBeenCalledWith('[electron] exited with code 1');
    expect(spawned).toHaveLength(5);
    expect(spawned[4]?.command).toContain('electron');

    vi.useRealTimers();
  });
});
