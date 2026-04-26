const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function ensureNodeNativeDeps() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const needsRebuild =
      message.includes('NODE_MODULE_VERSION') ||
      message.includes('Could not locate the bindings file') ||
      message.includes('better_sqlite3.node');

    if (!needsRebuild) {
      throw error;
    }

    const cacheRoot = path.resolve(__dirname, '..', '.cache');
    const npmCacheDir = path.join(cacheRoot, 'npm');
    const nodeGypDir = path.join(cacheRoot, 'node-gyp');
    fs.mkdirSync(npmCacheDir, { recursive: true });
    fs.mkdirSync(nodeGypDir, { recursive: true });

    console.log('[pretest] Rebuilding better-sqlite3 for the current Node runtime');
    execSync('npm rebuild better-sqlite3', {
      stdio: 'inherit',
      env: {
        ...process.env,
        npm_config_cache: npmCacheDir,
        npm_config_devdir: nodeGypDir,
        npm_config_runtime: 'node',
      },
    });
  }
}

ensureNodeNativeDeps();
