import fs from 'fs';
import path from 'path';
import type { PluginManifest, PluginRegistryEntry } from '@shared/types';
import { PluginStatus } from '@shared/types';
import { pluginManifestSchema } from '@shared/utils';
import { getPluginsPath } from '../utils/paths';
import { EventBus } from '../ipc/EventBus';
import { EVENTS } from '@shared/constants';

/**
 * 插件加载器 — 扫描、校验、加载插件
 */
export class PluginLoader {
  private registry = new Map<string, PluginRegistryEntry>();
  private eventBus: EventBus;
  private pluginsDir: string;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.pluginsDir = getPluginsPath();
    fs.mkdirSync(this.pluginsDir, { recursive: true });
  }

  /**
   * 扫描并加载所有插件
   */
  async loadAll(): Promise<void> {
    if (!fs.existsSync(this.pluginsDir)) return;

    const dirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
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
    this.registry.delete(name);
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
}
