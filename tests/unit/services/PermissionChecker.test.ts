import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionChecker } from '@main/plugin-loader/PermissionChecker';
import type { PluginManifest } from '@shared/types';
import { PermissionLevel } from '@shared/constants';

describe('PermissionChecker', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  function createManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
    return {
      name: 'test-plugin',
      version: '1.0.0',
      displayName: 'Test Plugin',
      description: 'Test',
      main: 'dist/index.js',
      permissions: [],
      permissionLevel: PermissionLevel.UI_READONLY,
      engines: { yclaw: '>=1.0.0' },
      ...overrides,
    };
  }

  describe('validateManifest', () => {
    it('should pass for Level 1 plugin with no extra permissions', () => {
      const manifest = createManifest({
        permissionLevel: PermissionLevel.UI_READONLY,
        permissions: ['ui', 'state:read'],
      });
      const result = checker.validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail for Level 1 plugin requesting network', () => {
      const manifest = createManifest({
        permissionLevel: PermissionLevel.UI_READONLY,
        permissions: ['network'],
      });
      const result = checker.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('network');
    });

    it('should pass for Level 2 plugin with network and storage', () => {
      const manifest = createManifest({
        permissionLevel: PermissionLevel.NETWORK_STORAGE,
        permissions: ['ui', 'network', 'storage'],
      });
      const result = checker.validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('should fail for Level 2 plugin requesting filesystem', () => {
      const manifest = createManifest({
        permissionLevel: PermissionLevel.NETWORK_STORAGE,
        permissions: ['filesystem'],
      });
      const result = checker.validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    it('should pass for Level 3 plugin with all permissions', () => {
      const manifest = createManifest({
        permissionLevel: PermissionLevel.AUTOMATION_FILESYSTEM,
        permissions: ['ui', 'network', 'storage', 'filesystem', 'automation', 'webcontents'],
      });
      const result = checker.validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('should fail for unknown permissions', () => {
      const manifest = createManifest({
        permissionLevel: PermissionLevel.AUTOMATION_FILESYSTEM,
        permissions: ['unknown-perm'],
      });
      const result = checker.validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    it('should report multiple violations', () => {
      const manifest = createManifest({
        permissionLevel: PermissionLevel.UI_READONLY,
        permissions: ['network', 'filesystem', 'automation'],
      });
      const result = checker.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(3);
    });
  });

  describe('hasPermission', () => {
    it('should return true for declared permission', () => {
      const manifest = createManifest({ permissions: ['network', 'storage'] });
      expect(checker.hasPermission(manifest, 'network')).toBe(true);
    });

    it('should return false for undeclared permission', () => {
      const manifest = createManifest({ permissions: ['network'] });
      expect(checker.hasPermission(manifest, 'filesystem')).toBe(false);
    });

    it('should return false for empty permissions', () => {
      const manifest = createManifest({ permissions: [] });
      expect(checker.hasPermission(manifest, 'network')).toBe(false);
    });
  });

  describe('requiresUserConfirmation', () => {
    it('should not require confirmation for Level 1', () => {
      const manifest = createManifest({ permissionLevel: PermissionLevel.UI_READONLY });
      expect(checker.requiresUserConfirmation(manifest)).toBe(false);
    });

    it('should require confirmation for Level 2', () => {
      const manifest = createManifest({ permissionLevel: PermissionLevel.NETWORK_STORAGE });
      expect(checker.requiresUserConfirmation(manifest)).toBe(true);
    });

    it('should require confirmation for Level 3', () => {
      const manifest = createManifest({ permissionLevel: PermissionLevel.AUTOMATION_FILESYSTEM });
      expect(checker.requiresUserConfirmation(manifest)).toBe(true);
    });
  });

  describe('requiresUninstallConfirmation', () => {
    it('should require explicit confirmation before uninstalling a plugin', () => {
      const manifest = createManifest();
      expect(checker.requiresUninstallConfirmation(manifest)).toBe(true);
    });
  });
});
