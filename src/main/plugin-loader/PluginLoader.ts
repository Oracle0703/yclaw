import fs from 'fs';
import path from 'path';
import type { PluginManifest, PluginRegistryEntry } from '@shared/types';
import { PluginStatus } from '@shared/types';
import { pluginManifestSchema } from '@shared/utils';
import { getPluginsPath } from '../utils/paths';
import { EventBus } from '../ipc/EventBus';
import { EVENTS } from '@shared/constants';
import { PermissionChecker } from './PermissionChecker';

export interface PluginInstallResult {
  name: string;
  permissions: string[];
  level: number;
  requiresConfirmation: boolean;
  status: 'pending' | 'installed' | 'cancelled';
  plugin?: PluginRegistryEntry;
}

interface PendingInstall {
  sourceDir: string;
  manifest: PluginManifest;
}

interface PluginLoaderOptions {
  eventBus?: Pick<EventBus, 'emit'>;
  permissionChecker?: Pick<
    PermissionChecker,
    'validateManifest' | 'requiresUserConfirmation'
  >;
}

/**
 * 插件加载器 — 扫描、校验、加载插件
 */
export class PluginLoader {
  private registry = new Map<string, PluginRegistryEntry>();
  private pendingInstalls = new Map<string, PendingInstall>();
  private eventBus: Pick<EventBus, 'emit'>;
  private pluginsDir: string;
  private permissionChecker: NonNullable<PluginLoaderOptions['permissionChecker']>;

  constructor(options: PluginLoaderOptions = {}) {
    if (!options.eventBus) {
      throw new Error('eventBus is required');
    }

    if (!options.permissionChecker) {
      throw new Error('permissionChecker is required');
    }

    this.eventBus = options.eventBus;
    this.pluginsDir = getPluginsPath();
    this.permissionChecker = options.permissionChecker;
    fs.mkdirSync(this.pluginsDir, { recursive: true });
  }

  /**
   * 扫描并加载所有插件
   */
  async loadAll(): Promise<void> {
    if (!fs.existsSync(this.pluginsDir)) return;

    const dirs = fs
      .readdirSync(this.pluginsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);

    for (const dir of dirs) {
      try {
        await this.loadPlugin(dir);
      } catch (err) {
        console.error(`Failed to load plugin "${dir}":`, err);
      }
    }
  }

  /**
   * 加载单个插件
   */
  async loadPlugin(dirName: string): Promise<PluginRegistryEntry> {
    const pluginDir = path.join(this.pluginsDir, dirName);
    const manifestPath = path.join(pluginDir, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`plugin.json not found in ${pluginDir}`);
    }

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Schema 校验
    const result = pluginManifestSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid plugin.json: ${result.error.message}`);
    }

    const manifest = result.data as PluginManifest;
    this.validatePermissions(manifest);

    const entry: PluginRegistryEntry = {
      manifest,
      status: PluginStatus.INSTALLED,
      path: pluginDir,
      loadedAt: new Date(),
    };

    this.registry.set(manifest.name, entry);
    this.eventBus.emit(EVENTS.PLUGIN_INSTALLED, { name: manifest.name });

    return entry;
  }

  /**
   * 从用户选择的本地插件目录安装
   * - L1 插件直接复制并加载
   * - L2/L3 插件先进入待确认队列
   */
  async installFromPath(sourcePath: string): Promise<PluginInstallResult> {
    const sourceDir = this.resolvePluginSourceDir(sourcePath);
    const manifest = this.readManifest(sourceDir);
    this.validatePermissions(manifest);

    if (this.permissionChecker.requiresUserConfirmation(manifest)) {
      this.pendingInstalls.set(manifest.name, { sourceDir, manifest });
      return this.toInstallResult(manifest, true, 'pending');
    }

    const plugin = await this.installResolvedPlugin(sourceDir, manifest);
    return this.toInstallResult(manifest, false, 'installed', plugin);
  }

  /**
   * 确认或取消高权限插件安装
   */
  async confirmPendingInstall(name: string, confirmed: boolean): Promise<PluginInstallResult> {
    const pending = this.pendingInstalls.get(name);
    if (!pending) {
      throw new Error(`Pending plugin install "${name}" not found`);
    }

    this.pendingInstalls.delete(name);

    if (!confirmed) {
      return this.toInstallResult(pending.manifest, true, 'cancelled');
    }

    const plugin = await this.installResolvedPlugin(pending.sourceDir, pending.manifest);
    return this.toInstallResult(pending.manifest, false, 'installed', plugin);
  }

  /**
   * 启用插件
   */
  activate(name: string): void {
    const entry = this.registry.get(name);
    if (!entry) throw new Error(`Plugin "${name}" not found`);
    entry.status = PluginStatus.ACTIVE;
    this.eventBus.emit(EVENTS.PLUGIN_ACTIVATED, { name });
  }

  /**
   * 禁用插件
   */
  deactivate(name: string): void {
    const entry = this.registry.get(name);
    if (!entry) throw new Error(`Plugin "${name}" not found`);
    entry.status = PluginStatus.INACTIVE;
    this.eventBus.emit(EVENTS.PLUGIN_DEACTIVATED, { name });
  }

  /**
   * 卸载插件
   */
  uninstall(name: string): void {
    const entry = this.registry.get(name);
    if (!entry) throw new Error(`Plugin "${name}" not found`);

    // 防止路径遍历：确保目标路径在 pluginsDir 内
    const resolvedPath = path.resolve(entry.path);
    const resolvedPluginsDir = path.resolve(this.pluginsDir);
    if (
      !resolvedPath.startsWith(resolvedPluginsDir + path.sep) &&
      resolvedPath !== resolvedPluginsDir
    ) {
      throw new Error(`Refusing to delete path outside plugins directory: ${resolvedPath}`);
    }

    this.registry.delete(name);
    fs.rmSync(entry.path, { recursive: true, force: true });
    this.eventBus.emit(EVENTS.PLUGIN_UNINSTALLED, { name });
  }

  /**
   * 获取所有已注册插件
   */
  getAll(): PluginRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * 获取指定插件
   */
  get(name: string): PluginRegistryEntry | undefined {
    return this.registry.get(name);
  }

  private resolvePluginSourceDir(sourcePath: string): string {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Plugin source "${sourcePath}" not found`);
    }

    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      return sourcePath;
    }

    if (stat.isFile() && path.basename(sourcePath) === 'plugin.json') {
      return path.dirname(sourcePath);
    }

    throw new Error('Local plugin install expects a plugin directory or plugin.json file');
  }

  private readManifest(pluginDir: string): PluginManifest {
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`plugin.json not found in ${pluginDir}`);
    }

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = pluginManifestSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid plugin.json: ${result.error.message}`);
    }
    return result.data as PluginManifest;
  }

  private validatePermissions(manifest: PluginManifest): void {
    const permissionResult = this.permissionChecker.validateManifest(manifest);
    if (!permissionResult.valid) {
      throw new Error(`Invalid plugin permissions: ${permissionResult.violations.join('; ')}`);
    }
  }

  private async installResolvedPlugin(
    sourceDir: string,
    manifest: PluginManifest,
  ): Promise<PluginRegistryEntry> {
    const targetDir = path.join(this.pluginsDir, manifest.name);
    if (path.resolve(sourceDir) !== path.resolve(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      fs.cpSync(sourceDir, targetDir, { recursive: true });
    }
    return this.loadPlugin(manifest.name);
  }

  private toInstallResult(
    manifest: PluginManifest,
    requiresConfirmation: boolean,
    status: PluginInstallResult['status'],
    plugin?: PluginRegistryEntry,
  ): PluginInstallResult {
    return {
      name: manifest.name,
      permissions: manifest.permissions,
      level: manifest.permissionLevel,
      requiresConfirmation,
      status,
      plugin,
    };
  }
}
