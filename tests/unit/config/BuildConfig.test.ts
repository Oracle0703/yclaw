import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SPEC-022: Build Configuration', () => {
  const rootDir = resolve(__dirname, '../../..');

  describe('electron-builder.yml', () => {
    it('should exist and be readable', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should contain appId', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toContain('appId');
    });

    it('should contain mac configuration', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toMatch(/^mac:/m);
    });

    it('should contain win configuration', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toMatch(/^win:/m);
    });

    it('should contain files configuration', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toContain('files');
    });

    it('should define a slim online installer target for Windows', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toContain('target: nsis-web');
      expect(content).toContain('nsisWeb:');
    });

    it('should restrict packaged files with explicit allowlists and excludes', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toContain('filter:');
      expect(content).toContain('!**/*.map');
      expect(content).toContain('!tests{,/**/*}');
      expect(content).toContain('!docs{,/**/*}');
    });

    it('should unpack only the better-sqlite3 native binary', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toContain('node_modules/better-sqlite3/build/Release/*.node');
      expect(content).not.toContain('node_modules/better-sqlite3/**/*');
    });

    it('should prune unpacked native dependency sources after packaging', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toContain('afterPack: scripts/after-pack-prune.cjs');
      const hook = readFileSync(resolve(rootDir, 'scripts/after-pack-prune.cjs'), 'utf-8');
      expect(hook).toContain('better-sqlite3');
      expect(hook).toContain('better_sqlite3.node');
    });

    it('should exclude runtime-unused node_modules sources, tests and type declarations', () => {
      const content = readFileSync(resolve(rootDir, 'electron-builder.yml'), 'utf-8');
      expect(content).toContain('!node_modules/**/*.d.ts');
      expect(content).toContain('!node_modules/**/*.d.cts');
      expect(content).toContain('!node_modules/**/*.d.mts');
      expect(content).toContain('!node_modules/**/src/**/*.ts');
      expect(content).toContain('!node_modules/**/src/**/*.tsx');
      expect(content).toContain('!node_modules/**/tests{,/**/*}');
      expect(content).toContain('!node_modules/**/__tests__{,/**/*}');
      expect(content).toContain('!node_modules/**/docs{,/**/*}');
      expect(content).toContain('!node_modules/**/examples{,/**/*}');
    });
  });

  describe('package.json scripts', () => {
    let pkg: Record<string, unknown>;

    it('should have build scripts', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts.build).toBeDefined();
      expect(scripts.dist).toBeDefined();
      expect(scripts['build:core']).toBeDefined();
      expect(scripts['build:features']).toBeDefined();
    });

    it('should have platform-specific dist scripts', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['dist:mac']).toContain('--mac');
      expect(scripts['dist:win']).toContain('--win');
      expect(scripts['dist:linux']).toContain('--linux');
      expect(scripts['dist:win:core']).toContain('tsx scripts/dist-win-core.ts');
      expect(scripts['dist:win:core']).not.toContain('electron-builder --win --config electron-builder.yml');
      expect(scripts['dist:win:full']).toContain('nsis');
    });

    it('should have postinstall script for native modules', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts.postinstall).toContain('electron-builder');
    });

    it('should have electron-builder in devDependencies', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps['electron-builder']).toBeDefined();
    });

    it('should have electron-updater in dependencies', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['electron-updater']).toBeDefined();
    });

    it('should keep renderer-only libraries in devDependencies to avoid packaging them into app.asar', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const deps = pkg.dependencies as Record<string, string>;
      const devDeps = pkg.devDependencies as Record<string, string>;
      const rendererOnlyLibraries = [
        'react',
        'react-dom',
        'react-router-dom',
        'antd',
        '@ant-design/icons',
        '@ant-design/pro-components',
        'zustand',
      ];

      for (const library of rendererOnlyLibraries) {
        expect(deps[library]).toBeUndefined();
        expect(devDeps[library]).toBeDefined();
      }
    });
  });

  describe('GitHub Actions workflows', () => {
    it('should keep release packaging installs deterministic and skip lifecycle scripts', () => {
      const content = readFileSync(resolve(rootDir, '.github/workflows/release.yml'), 'utf-8');
      expect(content).toContain('run: npm ci --no-audit --ignore-scripts');
      expect(content).not.toContain('rm -rf node_modules package-lock.json');
      expect(content).not.toContain('npm install --no-audit');
    });

    it('should skip Electron-native postinstall rebuilds in CI verification', () => {
      const content = readFileSync(resolve(rootDir, '.github/workflows/ci.yml'), 'utf-8');
      expect(content).toContain('SKIP_POSTINSTALL: 1');
      expect(content).toContain('npm_config_progress: false');
      expect(content).toContain('timeout-minutes: 12');
      expect(content).toContain('npm ci --no-audit --ignore-scripts --no-progress');
      expect(content).toContain('--fetch-retries=2');
      expect(content).not.toContain('rm -rf node_modules package-lock.json');
      expect(content).not.toContain('npm install --no-audit');
    });
  });

  describe('feature package manifest', () => {
    it('should declare every packaged feature module', () => {
      const manifest = JSON.parse(
        readFileSync(resolve(rootDir, 'resources/feature-manifest.json'), 'utf-8'),
      ) as { packages: Array<{ id: string; module: string; sourceDirectory?: string }> };
      const packagesByModule = new Map(manifest.packages.map((pkg) => [pkg.module, pkg]));

      for (const moduleName of ['stock', 'automation', 'data-center', 'plugin-center']) {
        const pkg = packagesByModule.get(moduleName);
        expect(pkg).toBeDefined();
        expect(pkg?.id).toBe(moduleName);
        expect(pkg?.sourceDirectory).toBe(`feature-packs/${moduleName}`);
      }
    });
  });

  describe('core renderer dependencies', () => {
    it('should not import @ant-design/pro-components in core package paths', () => {
      const coreFiles = [
        'src/renderer/shared/components/AdminPageLayout.tsx',
        'src/renderer/shared/components/PageShell.tsx',
        'src/renderer/entries/browser/App.tsx',
        'src/renderer/entries/workbench/pages/Home.tsx',
        'src/renderer/entries/workbench/pages/Settings.tsx',
      ];

      for (const file of coreFiles) {
        const content = readFileSync(resolve(rootDir, file), 'utf-8');
        expect(content).not.toContain('@ant-design/pro-components');
      }
    });
  });
});
