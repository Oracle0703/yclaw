import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { buildSpawnSpec } from './spawn-utils';
import { createElectronStderrFilter } from './dev-log-filter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const preloadOutput = resolve(rootDir, 'dist', 'dev', 'main', 'windows', 'preload.js');
const requireFromHere = createRequire(import.meta.url);
const electronExecutable = requireFromHere('electron') as string;

function getBin(name: string): string {
  return resolve(rootDir, 'node_modules', '.bin', `${name}${isWindows ? '.cmd' : ''}`);
}

function spawnProcess(
  command: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): ChildProcess {
  const spawnSpec = buildSpawnSpec(command, args, isWindows);

  return spawn(spawnSpec.command, spawnSpec.args, {
    cwd: rootDir,
    stdio: 'pipe',
    shell: spawnSpec.shell,
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

let viteReady = false;
let preloadReady = false;
let mainReady = false;
let electronProcess: ChildProcess | null = null;
let electronExitPromise: Promise<void> | null = null;
let isShuttingDown = false;
let restartScheduled = false;
let viteOrigin = 'http://localhost:5173';
let electronStderrFilter: ReturnType<typeof createElectronStderrFilter> | null = null;
const RESTART_DEBOUNCE_MS = 250;

const viteProcess = spawnProcess(getBin('vite'), [], {
  NODE_ENV: 'development',
});

const preloadProcess = spawnProcess(
  getBin('tsc'),
  ['-p', 'tsconfig.preload.json', '--watch', '--preserveWatchOutput'],
  {
    NODE_ENV: 'development',
  },
);

const mainProcess = spawnProcess(
  getBin('tsc'),
  ['-p', 'tsconfig.main.json', '--watch', '--preserveWatchOutput'],
  {
    NODE_ENV: 'development',
  },
);

function killElectronTree(pid: number): void {
  if (!pid) return;
  if (isWindows) {
    // Windows 上 child.kill('SIGTERM') 只杀直接子进程，electron 派生的 GPU/utility
    // 子进程会成为孤儿并占住 single-instance 锁。必须 /T /F 杀整棵进程树。
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* noop */
      }
    }
  }
}

function reapStrayElectronProcesses(): void {
  // 在启动新 electron 之前清理本仓库路径下可能残留的 electron.exe（上次 hot-reload
  // 或上次 dev 父进程被强制终止后留下的），避免 single-instance lock 占用。
  if (!isWindows) return;
  try {
    // wmic 查询 ExecutablePath 包含本仓库子串的 electron.exe，限定范围避免误杀。
    const repoTag = rootDir.replace(/\\/g, '\\\\').toLowerCase();
    const result = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLower().Contains('${repoTag}') } | ForEach-Object { $_.ProcessId }`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if (result.status !== 0 || !result.stdout) return;
    const pids = result.stdout
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
    for (const pid of pids) {
      killElectronTree(pid);
    }
    if (pids.length > 0) {
      console.log(`[dev] reaped ${pids.length} stray electron.exe before respawn`);
    }
  } catch {
    /* noop — 清理是 best-effort */
  }
}

function stopElectron(): Promise<void> {
  const current = electronProcess;
  const alreadyExited = !current || current.killed || typeof current.exitCode === 'number';
  if (alreadyExited) {
    electronProcess = null;
    electronExitPromise = null;
    return Promise.resolve();
  }

  const waiter =
    electronExitPromise ??
    new Promise<void>((resolvePromise) => {
      current.once('exit', () => resolvePromise());
    });
  electronExitPromise = waiter;

  if (current.pid) {
    killElectronTree(current.pid);
  } else {
    current.kill('SIGTERM');
  }
  electronProcess = null;

  // 超时兼底：1.5s 后若还没收到 exit 事件，强制认为已处理，避免锁死后续重启。
  const timeout = new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 1500));
  return Promise.race([waiter, timeout]);
}

function spawnElectron(): void {
  if (isShuttingDown) {
    return;
  }

  // 启动前清理可能存在的本仓库 electron 孤儿进程，避免 single-instance lock 被占用
  // 导致新进程启动后立刻 app.quit() 而看不到窗口。
  reapStrayElectronProcesses();

  const child = spawn(electronExecutable, ['src/main/index.ts'], {
    cwd: rootDir,
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' '),
      ELECTRON_PRELOAD_PATH: preloadOutput,
      ELECTRON_RENDERER_URL: viteOrigin,
    },
  });
  electronProcess = child;
  electronExitPromise = new Promise<void>((resolvePromise) => {
    child.once('exit', () => resolvePromise());
  });

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[electron] ${chunk}`);
  });

  electronStderrFilter = createElectronStderrFilter((line) => {
    process.stderr.write(line);
  });

  child.stderr?.on('data', (chunk) => {
    electronStderrFilter?.push(`[electron] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    electronStderrFilter?.flush();
    if (electronProcess === child) {
      electronProcess = null;
      electronExitPromise = null;
    }
    if (!isShuttingDown && signal !== 'SIGTERM' && code !== 0) {
      console.error(`[electron] exited with code ${code ?? 'null'}`);
    }
  });
}

function maybeStartElectron(): void {
  if (!viteReady || !preloadReady || !mainReady || isShuttingDown) {
    return;
  }
  if (restartScheduled) {
    return;
  }

  restartScheduled = true;
  setTimeout(() => {
    restartScheduled = false;
    if (isShuttingDown) {
      return;
    }

    void stopElectron().then(() => {
      if (isShuttingDown) {
        return;
      }
      spawnElectron();
    });
  }, RESTART_DEBOUNCE_MS);
}

viteProcess.stdout?.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  const localUrlMatch = text.match(/Local:\s+(http:\/\/[^\s]+)/);
  if (localUrlMatch?.[1]) {
    viteOrigin = localUrlMatch[1];
  }

  if (text.includes('Local:') || text.includes('ready in')) {
    viteReady = true;
    maybeStartElectron();
  }
});

viteProcess.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk);
});

preloadProcess.stdout?.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (text.includes('Found 0 errors') || text.includes('Watching for file changes.')) {
    preloadReady = true;
    maybeStartElectron();
  }
});

preloadProcess.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk);
});

mainProcess.stdout?.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (text.includes('Found 0 errors') || text.includes('Watching for file changes.')) {
    mainReady = true;
    maybeStartElectron();
  }
});

mainProcess.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk);
});

function awaitChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise<void>((resolvePromise) => {
    child.once('exit', () => resolvePromise());
  });
}

function killWatcher(child: ChildProcess): Promise<void> {
  if (!child.killed && child.exitCode === null) {
    child.kill('SIGTERM');
  }
  return awaitChildExit(child);
}

function shutdown(exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  const pending = Promise.all([
    stopElectron(),
    killWatcher(viteProcess),
    killWatcher(preloadProcess),
    killWatcher(mainProcess),
  ]);

  // 等子进程真正退出再让父进程 process.exit，避免在 Windows 上把 electron.exe
  // 留成无主窗口的孤儿（会一直占着 single-instance lock，导致下次启动看不到任何窗口）。
  const timeout = new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 2500));
  void Promise.race([pending.then(() => undefined), timeout]).then(() => {
    process.exit(exitCode);
  });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) {
  // 某些信号在 Windows 上不存在，注册时忽略错误即可。
  try {
    process.on(signal, () => shutdown(0));
  } catch {
    /* ignore unsupported signal */
  }
}

// 父进程异常退出兜底：同步发一次 kill，尽量不留孤儿。
process.on('exit', () => {
  if (electronProcess?.pid) {
    killElectronTree(electronProcess.pid);
  }
  for (const child of [viteProcess, preloadProcess, mainProcess]) {
    if (child && !child.killed && child.exitCode === null) {
      try {
        child.kill('SIGTERM');
      } catch {
        /* noop */
      }
    }
  }
});

viteProcess.on('exit', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.error(`[vite] exited with code ${code ?? 'null'}`);
    shutdown(code ?? 1);
  }
});

preloadProcess.on('exit', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.error(`[tsc] exited with code ${code ?? 'null'}`);
    shutdown(code ?? 1);
  }
});

mainProcess.on('exit', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.error(`[main-tsc] exited with code ${code ?? 'null'}`);
    shutdown(code ?? 1);
  }
});
