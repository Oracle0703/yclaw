const path = require('path');
const process = require('process');
const { getDevRuntimeFailure } = require('./ensure-dev-runtime-utils.js');
const { ensureElectronNativeDeps } = require('./ensure-electron-native-deps.cjs');

function fail(message) {
  console.error(`[predev] ${message}`);
  process.exit(1);
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
  console.log('[predev] Checking better-sqlite3 for the Electron runtime');
  ensureElectronNativeDeps(rootDir);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

reapStrayElectronProcesses(rootDir);
