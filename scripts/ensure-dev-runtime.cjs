const fs = require('fs');
const path = require('path');
const process = require('process');

function fail(message) {
  console.error(`[predev] ${message}`);
  process.exit(1);
}

const major = Number.parseInt(process.versions.node.split('.')[0] || '', 10);
if (!Number.isFinite(major) || major < 20 || major >= 23) {
  fail(
    `Unsupported Node.js ${process.version}. Use the repo runtime from .nvmrc (${fs
      .readFileSync(path.resolve(__dirname, '..', '.nvmrc'), 'utf8')
      .trim()}).`,
  );
}

const electronDir = path.resolve(__dirname, '..', 'node_modules', 'electron');
const electronPathFile = path.join(electronDir, 'path.txt');

if (!fs.existsSync(electronDir)) {
  fail('electron is not installed. Run `npm install` first.');
}

if (!fs.existsSync(electronPathFile)) {
  fail(
    'Electron binary is missing (`node_modules/electron/path.txt` not found). ' +
      'Reinstall dependencies with scripts enabled: `npm install --no-audit --no-fund`.',
  );
}
