const fs = require('fs');
const path = require('path');

function readExpectedNodeVersion(rootDir) {
  try {
    return fs.readFileSync(path.join(rootDir, '.nvmrc'), 'utf8').trim();
  } catch {
    return '20.19.0';
  }
}

function getDevRuntimeFailure(options) {
  const rootDir = options.rootDir;
  const nodeVersion = options.nodeVersion ?? process.version;
  const major = Number.parseInt((nodeVersion || '').replace(/^v/, '').split('.')[0] || '', 10);

  if (!Number.isFinite(major) || major < 20 || major >= 23) {
    return `Unsupported Node.js ${nodeVersion}. Use the repo runtime from .nvmrc (${readExpectedNodeVersion(rootDir)}).`;
  }

  const electronDir = path.join(rootDir, 'node_modules', 'electron');
  const electronPathFile = path.join(electronDir, 'path.txt');

  if (!fs.existsSync(electronDir)) {
    return 'electron is not installed. Run `npm install` first.';
  }

  if (!fs.existsSync(electronPathFile)) {
    return (
      'Electron binary is missing (`node_modules/electron/path.txt` not found). ' +
      'Reinstall dependencies with scripts enabled: `npm install --no-audit --no-fund`.'
    );
  }

  const electronExecutable = fs.readFileSync(electronPathFile, 'utf8').trim();
  const electronBinary = path.join(electronDir, 'dist', electronExecutable);
  if (!electronExecutable || !fs.existsSync(electronBinary)) {
    return (
      'Electron binary is incomplete. ' +
      'Run `npm install --no-audit --no-fund` or restore `node_modules/electron/dist`.'
    );
  }

  const betterSqliteBinary = path.join(
    rootDir,
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  );
  if (!fs.existsSync(betterSqliteBinary)) {
    return (
      'better-sqlite3 native binding is missing (`node_modules/better-sqlite3/build/Release/better_sqlite3.node`). ' +
      'Run `npx electron-builder install-app-deps` to rebuild Electron native dependencies.'
    );
  }

  return null;
}

module.exports = {
  getDevRuntimeFailure,
};
