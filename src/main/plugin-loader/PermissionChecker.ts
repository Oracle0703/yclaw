import type { PluginManifest } from '@shared/types';
import { PermissionLevel, PERMISSION_LEVEL_CAPABILITIES } from '@shared/constants';

/**
 * 权限校验器 — 三级权限模型 + 白名单
 */
export class PermissionChecker {
  /**
   * 校验插件声明的权限是否在其权限等级允许的范围内
   */
  validateManifest(manifest: PluginManifest): { valid: boolean; violations: string[] } {
    const allowed = PERMISSION_LEVEL_CAPABILITIES[manifest.permissionLevel as PermissionLevel] ?? [];
    const violations: string[] = [];

    for (const perm of manifest.permissions) {
      if (!allowed.includes(perm)) {
        violations.push(
          `Permission "${perm}" is not allowed at level ${manifest.permissionLevel}`,
        );
      }
    }

    return { valid: violations.length === 0, violations };
  }

  /**
   * 检查插件是否有指定权限
   */
  hasPermission(manifest: PluginManifest, permission: string): boolean {
    return manifest.permissions.includes(permission);
  }

  /**
   * 判断插件安装时是否需要用户确认
   */
  requiresUserConfirmation(manifest: PluginManifest): boolean {
    return manifest.permissionLevel >= PermissionLevel.NETWORK_STORAGE;
  }

  /**
   * 卸载会移除插件资产，必须由用户显式确认
   */
  requiresUninstallConfirmation(_manifest: PluginManifest): boolean {
    return true;
  }
}
