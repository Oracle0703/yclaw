const fs = require('fs');
const path = require('path');

const MARKER_RELATIVE_PATH = path.join('.cache', 'native-deps-runtime');

/**
 * 判定错误信息是否表示 better-sqlite3 原生模块需要为当前运行时重新编译。
 * 同时覆盖：
 *   - ABI 版本不匹配（NODE_MODULE_VERSION ... different Node.js version）
 *   - 找不到 .node 绑定文件
 *   - dlopen 失败（例如 ABI 不匹配时 Electron 抛出的 ERR_DLOPEN_FAILED）
 *
 * @param {string|undefined|null} message
 * @returns {boolean}
 */
function isNativeAbiOrBindingError(message) {
  if (!message) return false;
  return (
    message.includes('NODE_MODULE_VERSION') ||
    message.includes('Could not locate the bindings file') ||
    message.includes('better_sqlite3.node') ||
    message.includes('ERR_DLOPEN_FAILED')
  );
}

/**
 * 描述「为当前 Node 运行时重新编译 better-sqlite3」需要做的事情，
 * 由调用方负责真正执行（execSync），便于单元测试。
 *
 * @param {{ cacheRoot: string }} options
 */
function buildNodeRebuildPlan(options) {
  const cacheRoot = options.cacheRoot;
  if (!cacheRoot) {
    throw new Error('buildNodeRebuildPlan requires a cacheRoot path');
  }
  const npmCacheDir = path.join(cacheRoot, 'npm');
  const nodeGypDir = path.join(cacheRoot, 'node-gyp');
  return {
    command: 'npm rebuild better-sqlite3',
    env: {
      npm_config_cache: npmCacheDir,
      npm_config_devdir: nodeGypDir,
      npm_config_runtime: 'node',
    },
    directories: [npmCacheDir, nodeGypDir],
  };
}

/**
 * 描述「把 better-sqlite3 还原成 Electron ABI」需要做的事情。
 * 通过 electron-builder install-app-deps 触发 @electron/rebuild。
 */
function buildElectronRestorePlan() {
  return {
    command: 'npx --yes electron-builder install-app-deps',
  };
}

function markerFilePath(rootDir) {
  return path.join(rootDir, MARKER_RELATIVE_PATH);
}

/**
 * 读取上次为哪个运行时编译的本地原生依赖。
 * 返回 'node' / 'electron' / null（未知）。
 *
 * @param {string} rootDir
 * @returns {'node'|'electron'|null}
 */
function readRuntimeMarker(rootDir) {
  try {
    const value = fs.readFileSync(markerFilePath(rootDir), 'utf8').trim();
    if (value === 'node' || value === 'electron') return value;
    return null;
  } catch {
    return null;
  }
}

/**
 * 写入当前已编译运行时标记。
 *
 * @param {string} rootDir
 * @param {'node'|'electron'} value
 */
function writeRuntimeMarker(rootDir, value) {
  if (value !== 'node' && value !== 'electron') {
    throw new Error(`Unsupported runtime marker: ${value}`);
  }
  const filePath = markerFilePath(rootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

module.exports = {
  MARKER_RELATIVE_PATH,
  isNativeAbiOrBindingError,
  buildNodeRebuildPlan,
  buildElectronRestorePlan,
  readRuntimeMarker,
  writeRuntimeMarker,
};
