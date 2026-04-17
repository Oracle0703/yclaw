import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '@shared/types';
import { FeaturePackageService } from '@main/services/FeaturePackageService';

function createConfigState(): AppConfig {
  return {
    general: {
      theme: 'system',
      language: 'zh-CN',
      startupBehavior: 'showWorkbench',
      closeToTray: false,
    },
    modules: {},
    plugins: {},
    ai: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      baseUrl: 'https://api.openai.com/v1',
      temperature: 0.7,
      maxTokens: 2048,
    },
    featurePackages: {},
  };
}

describe('FeaturePackageService', () => {
  const rootDir = path.join(os.tmpdir(), `yclaw-feature-packages-${Date.now()}`);
  const sourceDir = path.join(rootDir, 'source');
  const installRoot = path.join(rootDir, 'installed');
  const manifestPath = path.join(rootDir, 'feature-manifest.json');

  let configState: AppConfig;
  let service: FeaturePackageService;

  beforeEach(() => {
    fs.mkdirSync(path.join(sourceDir, 'entries', 'stock'), { recursive: true });
    fs.writeFileSync(
      path.join(sourceDir, 'entries', 'stock', 'index.html'),
      '<html><body>stock</body></html>',
      'utf-8',
    );

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          packages: [
            {
              id: 'stock',
              module: 'stock',
              displayName: '股票分析',
              version: '1.0.0',
              files: [
                {
                  path: 'entries/stock/index.html',
                  source: path.join(sourceDir, 'entries', 'stock', 'index.html'),
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    );

    configState = createConfigState();
    service = new FeaturePackageService({
      manifestPath,
      installRoot,
      configService: {
        get: (key) => configState[key],
        set: (key, value) => {
          configState[key] = value;
        },
      },
    });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('requires config service injection', () => {
    expect(
      () =>
        new FeaturePackageService({
          manifestPath,
          installRoot,
        }),
    ).toThrowError('configService is required');
  });

  it('lists declared feature packages with install status', () => {
    const packages = service.listPackages();
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      id: 'stock',
      module: 'stock',
      installed: false,
    });
  });

  it('lets manifest version override stale persisted install state', () => {
    configState.featurePackages = {
      stock: {
        installed: true,
        version: '0.9.0-legacy',
        installedAt: '2024-01-01T00:00:00.000Z',
        entryPath: path.join(
          installRoot,
          'stock',
          '0.9.0-legacy',
          'entries',
          'stock',
          'index.html',
        ),
      },
    };

    const [pkg] = service.listPackages();
    expect(pkg.version).toBe('1.0.0');
    // 即使历史 entryPath 已失效，当前 manifest 元数据依然可见
    expect(pkg.id).toBe('stock');
  });

  it('installs a feature package from local file sources and persists state', async () => {
    const result = await service.installPackage('stock');

    expect(result).toMatchObject({
      id: 'stock',
      installed: true,
      version: '1.0.0',
    });

    const entryPath = service.getInstalledEntryPath('stock');
    expect(entryPath).toBeTruthy();
    expect(fs.existsSync(entryPath!)).toBe(true);
    expect(configState.featurePackages.stock).toMatchObject({
      installed: true,
      version: '1.0.0',
    });
  });
});
