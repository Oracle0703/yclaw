const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');
const { isNativeAbiOrBindingError } = require('./ensure-node-native-deps-utils.js');

function getElectronBinary(rootDir) {
  const electronDir = path.join(rootDir, 'node_modules', 'electron');
  const electronExecutable = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8').trim();
  return path.join(electronDir, 'dist', electronExecutable);
}

function getElectronRebuildBinary(rootDir) {
  return path.join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild',
  );
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
    return;
  } catch (error) {
    const output = readErrorOutput(error);
    if (!isNativeAbiOrBindingError(output)) {
      throw error;
    }
  }

  const electronRebuildBin = getElectronRebuildBinary(rootDir);
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

module.exports = {
  ensureElectronNativeDeps,
};
