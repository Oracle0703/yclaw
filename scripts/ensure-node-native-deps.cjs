const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  isNativeAbiOrBindingError,
  buildNodeRebuildPlan,
  reapRepoElectronProcesses,
  writeRuntimeMarker,
} = require('./ensure-node-native-deps-utils.js');

function ensureNodeNativeDeps() {
  const rootDir = path.resolve(__dirname, '..');

  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    // 加载成功说明当前 .node 已经是 Node ABI。
    writeRuntimeMarker(rootDir, 'node');
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isNativeAbiOrBindingError(message)) {
      throw error;
    }

    const plan = buildNodeRebuildPlan({ cacheRoot: path.join(rootDir, '.cache') });
    for (const dir of plan.directories) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const reapedPids = reapRepoElectronProcesses(rootDir);
    if (reapedPids.length > 0) {
      console.log(`[pretest] Stopped ${reapedPids.length} Electron process(es) before rebuild`);
    }

    console.log('[pretest] Rebuilding better-sqlite3 for the current Node runtime');
    execSync(plan.command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...plan.env,
      },
    });

    writeRuntimeMarker(rootDir, 'node');
  }
}

ensureNodeNativeDeps();
