interface PluginRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface PluginRow {
  name: string;
  version: string;
  status: string;
}

export class PluginRepository {
  constructor(private readonly executor: PluginRepositoryExecutor) {}

  getInstalledPlugins(): Array<{
    name: string;
    version: string;
    enabled: boolean;
  }> {
    return this.executor.all<PluginRow>(
      `
        SELECT name, version, status
        FROM plugins
        ORDER BY name ASC
      `,
    ).map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      enabled: plugin.status === 'active',
    }));
  }
}
