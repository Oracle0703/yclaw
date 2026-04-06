import { spawn, type ChildProcess } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const preloadOutput = resolve(rootDir, 'dist', 'dev', 'main', 'windows', 'preload.js');

function getBin(name: string): string {
  return resolve(rootDir, 'node_modules', '.bin', `${name}${isWindows ? '.cmd' : ''}`);
}

function spawnProcess(
  command: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): ChildProcess {
  return spawn(command, args, {
    cwd: rootDir,
    stdio: 'pipe',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

let viteReady = false;
let preloadReady = false;
let electronProcess: ChildProcess | null = null;
let isShuttingDown = false;
let viteOrigin = 'http://localhost:5173';

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

function stopElectron(): void {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill('SIGTERM');
  }
  electronProcess = null;
}

function maybeStartElectron(): void {
  if (!viteReady || !preloadReady || isShuttingDown) {
    return;
  }

  stopElectron();

  electronProcess = spawnProcess(getBin('electron'), ['src/main/index.ts'], {
    NODE_ENV: 'development',
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' '),
    ELECTRON_PRELOAD_PATH: preloadOutput,
    ELECTRON_RENDERER_URL: viteOrigin,
  });

  electronProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[electron] ${chunk}`);
  });

  electronProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[electron] ${chunk}`);
  });

  electronProcess.on('exit', (code, signal) => {
    if (!isShuttingDown && signal !== 'SIGTERM' && code !== 0) {
      console.error(`[electron] exited with code ${code ?? 'null'}`);
    }
  });
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

function shutdown(exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  stopElectron();

  if (!viteProcess.killed) {
    viteProcess.kill('SIGTERM');
  }

  if (!preloadProcess.killed) {
    preloadProcess.kill('SIGTERM');
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
