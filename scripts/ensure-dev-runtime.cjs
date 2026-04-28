const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');
const { getDevRuntimeFailure } = require('./ensure-dev-runtime-utils.js');

function fail(message) {
  console.error(`[predev] ${message}`);
  process.exit(1);
}

function getElectronBinary(rootDir) {
  const electronDir = path.join(rootDir, 'node_modules', 'electron');
  const electronExecutable = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8').trim();
  return path.join(electronDir, 'dist', electronExecutable);
}

function readErrorOutput(error) {
  const parts = [error instanceof Error ? error.message : String(error)];

  if (error && typeof error === 'object') {
    if (typeof error.stdout === 'string' && error.stdout) {
      parts.push(error.stdout);
    }
    if (typeof error.stderr === 'string' && error.stderr) {
      parts.push(error.stderr);
    }
    if (Buffer.isBuffer(error.stdout) && error.stdout.length > 0) {
      parts.push(error.stdout.toString('utf8'));
    }
    if (Buffer.isBuffer(error.stderr) && error.stderr.length > 0) {
      parts.push(error.stderr.toString('utf8'));
    }
  }

  return parts.join('\n');
}

function ensureElectronNativeDeps(rootDir) {
  const electronBinary = getElectronBinary(rootDir);

  try {
    execFileSync(
      electronBinary,
      [
        '-e',
        'const Database=require("better-sqlite3"); const db=new Database(":memory:"); db.close();',
      ],
      {
        cwd: rootDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
        },
      },
    );
  } catch (error) {
    const output = readErrorOutput(error);
    const needsRebuild =
      output.includes('NODE_MODULE_VERSION') ||
      output.includes('Could not locate the bindings file') ||
      output.includes('better_sqlite3.node') ||
      output.includes('ERR_DLOPEN_FAILED');

    if (!needsRebuild) {
      throw error;
    }

    console.log('[predev] Rebuilding better-sqlite3 for the Electron runtime');
    // 注意：electron-builder install-app-deps 会按 cache 判定是否需要 rebuild，
    // 在某些情况下（cache 命中但实际 binary 仍是 Node ABI）会跳过真正的 link，
    // 导致 dev 启动 electron 时仍然 ERR_DLOPEN_FAILED。改用 @electron/rebuild
    // CLI 并加 -f 强制重建，确保 binary 真的被重写为目标 ABI。
    const electronRebuildBin = path.join(
      rootDir,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild',
    );
    if (!fs.existsSync(electronRebuildBin)) {
      throw new Error(
        `electron-rebuild binary not found at ${electronRebuildBin}; run "npm install" first.`,
      );
    }
    execFileSync(electronRebuildBin, ['-f', '-w', 'better-sqlite3'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }
}

function reapStrayElectronProcesses(rootDir) {
  // Windows 上若 dev 父进程被强制结束，electron.exe 会留成孤儿持有 single-instance lock。
  // 启动新 dev 之前清理本仓库路径下残留的 electron.exe。
  if (process.platform !== 'win32') return;
  try {
    const repoTag = rootDir.replace(/\\/g, '\\\\').toLowerCase();
    const result = require('child_process').spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter \"Name='electron.exe'\" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLower().Contains('${repoTag}') } | ForEach-Object { $_.ProcessId }`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if (result.status !== 0 || !result.stdout) return;
    const pids = result.stdout
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
    for (const pid of pids) {
      require('child_process').spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    }
    if (pids.length > 0) {
      console.log(
        `[predev] reaped ${pids.length} stray electron.exe holding the single-instance lock`,
      );
    }
  } catch {
    /* best-effort */
  }
}

const rootDir = path.resolve(__dirname, '..');
const failure = getDevRuntimeFailure({
  rootDir,
  nodeVersion: process.version,
});

if (failure) {
  fail(failure);
}

try {
  ensureElectronNativeDeps(rootDir);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

reapStrayElectronProcesses(rootDir);
