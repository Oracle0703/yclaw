const { execSync } = require('child_process');
const path = require('path');

const {
  buildElectronRestorePlan,
  readRuntimeMarker,
  writeRuntimeMarker,
} = require('./ensure-node-native-deps-utils.js');

function restoreElectronNativeDeps() {
  if (process.env.YCLAW_SKIP_ELECTRON_RESTORE) return;

  const rootDir = path.resolve(__dirname, '..');
  if (readRuntimeMarker(rootDir) !== 'node') {
    // 当前未处于「为 Node 重建」状态，无需还原。
    return;
  }

  const plan = buildElectronRestorePlan();
  console.log('[restore-electron] Restoring better-sqlite3 for the Electron runtime');
  try {
    execSync(plan.command, { stdio: 'inherit' });
    writeRuntimeMarker(rootDir, 'electron');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[restore-electron] Failed to restore Electron native deps: ${message}`);
    console.error(
      '[restore-electron] Run `npx electron-builder install-app-deps` manually before `npm run dev`.',
    );
  }
}

restoreElectronNativeDeps();
