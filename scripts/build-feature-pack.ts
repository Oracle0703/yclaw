import { spawnSync } from 'child_process';
import path from 'path';

const featureEntry = process.argv[2];

if (!featureEntry) {
  throw new Error('Missing feature entry name');
}

const rootDir = path.resolve(__dirname, '..');
const viteBin = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

const result = spawnSync(process.execPath, [viteBin, 'build', '--mode', 'feature'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    YCLAW_BUILD_TARGET: 'feature',
    YCLAW_FEATURE_ENTRY: featureEntry,
  },
});

process.exit(result.status ?? 1);
