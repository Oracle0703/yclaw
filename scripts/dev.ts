import { spawn, type ChildProcess } from 'child_process';
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

  current.kill('SIGTERM');
  electronProcess = null;
  return waiter;
}

function spawnElectron(): void {
  if (isShuttingDown) {
    return;
  }

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

function shutdown(exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  void stopElectron();

  if (!viteProcess.killed) {
    viteProcess.kill('SIGTERM');
  }

  if (!preloadProcess.killed) {
    preloadProcess.kill('SIGTERM');
  }

  if (!mainProcess.killed) {
    mainProcess.kill('SIGTERM');
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 100);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown(0));
}

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
