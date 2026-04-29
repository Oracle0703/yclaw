import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const requireFromHere = createRequire(import.meta.url);
const { getDevRuntimeFailure } = requireFromHere(
  '../../../scripts/ensure-dev-runtime-utils.js',
) as {
  getDevRuntimeFailure: (options: { rootDir: string; nodeVersion?: string }) => string | null;
};

const tempRoots: string[] = [];

function createTempRoot(): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'yclaw-runtime-check-'));
  tempRoots.push(rootDir);
  writeFileSync(join(rootDir, '.nvmrc'), '22.22.0\n');
  return rootDir;
}

function ensureFile(path: string, content = ''): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

function createElectronInstall(rootDir: string, executable = 'electron.exe'): void {
  const electronDir = join(rootDir, 'node_modules', 'electron');
  ensureFile(join(electronDir, 'path.txt'), executable);
  ensureFile(join(electronDir, 'dist', executable), 'binary');
}

function createBetterSqliteBinding(rootDir: string): void {
  ensureFile(
    join(rootDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    'native-binary',
  );
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('getDevRuntimeFailure', () => {
  it('在 Node 主版本不是 22 时返回明确错误（v18）', () => {
    const rootDir = createTempRoot();

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v18.20.0' })).toContain(
      'Unsupported Node.js v18.20.0',
    );
  });

  it('在 Node 主版本不是 22 时返回明确错误（v20）', () => {
    const rootDir = createTempRoot();

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v20.19.0' })).toContain(
      'Unsupported Node.js v20.19.0',
    );
  });

  it('在 Node 主版本不是 22 时返回明确错误（v24）', () => {
    const rootDir = createTempRoot();

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v24.0.0' })).toContain(
      'Unsupported Node.js v24.0.0',
    );
  });

  it('在缺少 electron path.txt 时提示重新安装 Electron 二进制', () => {
    const rootDir = createTempRoot();
    mkdirSync(join(rootDir, 'node_modules', 'electron'), { recursive: true });
    createBetterSqliteBinding(rootDir);

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v22.22.0' })).toContain(
      'Electron binary is missing',
    );
  });

  it('在 path.txt 指向的 Electron 可执行文件缺失时返回明确错误', () => {
    const rootDir = createTempRoot();
    const electronDir = join(rootDir, 'node_modules', 'electron');
    ensureFile(join(electronDir, 'path.txt'), 'electron.exe');
    createBetterSqliteBinding(rootDir);

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v22.22.0' })).toContain(
      'Electron binary is incomplete',
    );
  });

  it('在 better-sqlite3 绑定缺失时提示重建原生依赖', () => {
    const rootDir = createTempRoot();
    createElectronInstall(rootDir);

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v22.22.0' })).toContain(
      'better-sqlite3 native binding is missing',
    );
  });

  it('在运行时依赖齐全时返回 null', () => {
    const rootDir = createTempRoot();
    createElectronInstall(rootDir);
    createBetterSqliteBinding(rootDir);

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v22.22.0' })).toBeNull();
  });

  it('在 Node 22 任意补丁版本下都视为受支持', () => {
    const rootDir = createTempRoot();
    createElectronInstall(rootDir);
    createBetterSqliteBinding(rootDir);

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v22.0.0' })).toBeNull();
    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v22.99.99' })).toBeNull();
  });

  it('错误信息包含 .nvmrc 中的目标版本', () => {
    const rootDir = createTempRoot();

    expect(getDevRuntimeFailure({ rootDir, nodeVersion: 'v20.0.0' })).toContain('22.22.0');
  });
});
