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
  });

  describe('package.json scripts', () => {
    let pkg: Record<string, unknown>;

    it('should have build scripts', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts.build).toBeDefined();
      expect(scripts.dist).toBeDefined();
    });

    it('should have platform-specific dist scripts', () => {
      const content = readFileSync(resolve(rootDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['dist:mac']).toContain('--mac');
      expect(scripts['dist:win']).toContain('--win');
      expect(scripts['dist:linux']).toContain('--linux');
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
  });
});
