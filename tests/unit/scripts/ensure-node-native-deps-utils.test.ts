import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const requireFromHere = createRequire(import.meta.url);
const utils = requireFromHere('../../../scripts/ensure-node-native-deps-utils.js') as {
  MARKER_RELATIVE_PATH: string;
  isNativeAbiOrBindingError: (message: string | null | undefined) => boolean;
  buildNodeRebuildPlan: (options: { cacheRoot: string }) => {
    command: string;
    env: Record<string, string>;
    directories: string[];
  };
  buildElectronRestorePlan: () => { command: string };
  readRuntimeMarker: (rootDir: string) => 'node' | 'electron' | null;
  writeRuntimeMarker: (rootDir: string, value: 'node' | 'electron') => void;
};

const tempRoots: string[] = [];

function createTempRoot(): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'yclaw-native-deps-'));
  tempRoots.push(rootDir);
  return rootDir;
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('isNativeAbiOrBindingError', () => {
  it('识别 NODE_MODULE_VERSION ABI 不匹配错误', () => {
    const message =
      "The module '...better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 115. This version of Node.js requires NODE_MODULE_VERSION 145.";
    expect(utils.isNativeAbiOrBindingError(message)).toBe(true);
  });

  it('识别缺失绑定文件错误', () => {
    expect(utils.isNativeAbiOrBindingError('Could not locate the bindings file. Tried: ...')).toBe(
      true,
    );
  });

  it('识别 ERR_DLOPEN_FAILED', () => {
    expect(utils.isNativeAbiOrBindingError('dlopen failed: ERR_DLOPEN_FAILED')).toBe(true);
  });

  it('识别仅出现 .node 文件路径的错误', () => {
    expect(utils.isNativeAbiOrBindingError('cannot find better_sqlite3.node in any path')).toBe(
      true,
    );
  });

  it('对无关错误返回 false', () => {
    expect(utils.isNativeAbiOrBindingError('SyntaxError: Unexpected token')).toBe(false);
    expect(utils.isNativeAbiOrBindingError(null)).toBe(false);
    expect(utils.isNativeAbiOrBindingError(undefined)).toBe(false);
    expect(utils.isNativeAbiOrBindingError('')).toBe(false);
  });
});

describe('buildNodeRebuildPlan', () => {
  it('构造为 Node runtime 重建的命令与缓存目录', () => {
    const rootDir = createTempRoot();
    const cacheRoot = join(rootDir, '.cache');

    const plan = utils.buildNodeRebuildPlan({ cacheRoot });

    expect(plan.command).toBe('npm rebuild better-sqlite3');
    expect(plan.env.npm_config_runtime).toBe('node');
    expect(plan.env.npm_config_cache).toBe(join(cacheRoot, 'npm'));
    expect(plan.env.npm_config_devdir).toBe(join(cacheRoot, 'node-gyp'));
    expect(plan.directories).toEqual([join(cacheRoot, 'npm'), join(cacheRoot, 'node-gyp')]);
  });

  it('在缺少 cacheRoot 时抛错', () => {
    expect(() => utils.buildNodeRebuildPlan({ cacheRoot: '' as unknown as string })).toThrowError(
      /cacheRoot/,
    );
  });
});

describe('buildElectronRestorePlan', () => {
  it('返回 electron-builder install-app-deps 命令', () => {
    expect(utils.buildElectronRestorePlan()).toEqual({
      command: 'npx --yes electron-builder install-app-deps',
    });
  });
});

describe('runtime marker', () => {
  it('在标记不存在时返回 null', () => {
    const rootDir = createTempRoot();
    expect(utils.readRuntimeMarker(rootDir)).toBeNull();
  });

  it('写入 node 标记并能读回', () => {
    const rootDir = createTempRoot();
    utils.writeRuntimeMarker(rootDir, 'node');

    expect(existsSync(join(rootDir, utils.MARKER_RELATIVE_PATH))).toBe(true);
    expect(utils.readRuntimeMarker(rootDir)).toBe('node');
  });

  it('写入 electron 标记会覆盖之前的 node 标记', () => {
    const rootDir = createTempRoot();
    utils.writeRuntimeMarker(rootDir, 'node');
    utils.writeRuntimeMarker(rootDir, 'electron');

    expect(utils.readRuntimeMarker(rootDir)).toBe('electron');
  });

  it('写入未知值时抛错', () => {
    const rootDir = createTempRoot();
    expect(() => utils.writeRuntimeMarker(rootDir, 'python' as unknown as 'node')).toThrowError(
      /Unsupported runtime marker/,
    );
  });

  it('忽略损坏的标记内容并返回 null', () => {
    const rootDir = createTempRoot();
    const markerPath = join(rootDir, utils.MARKER_RELATIVE_PATH);
    mkdirSync(join(markerPath, '..'), { recursive: true });
    writeFileSync(markerPath, 'garbage-value');

    expect(utils.readRuntimeMarker(rootDir)).toBeNull();
  });

  it('读取标记会去除两端空白', () => {
    const rootDir = createTempRoot();
    const markerPath = join(rootDir, utils.MARKER_RELATIVE_PATH);
    mkdirSync(join(markerPath, '..'), { recursive: true });
    writeFileSync(markerPath, '  electron\n');

    expect(utils.readRuntimeMarker(rootDir)).toBe('electron');
  });

  it('写入后实际文件内容为标记值', () => {
    const rootDir = createTempRoot();
    utils.writeRuntimeMarker(rootDir, 'electron');

    expect(readFileSync(join(rootDir, utils.MARKER_RELATIVE_PATH), 'utf8')).toBe('electron');
  });
});
