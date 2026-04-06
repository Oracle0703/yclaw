import React, { useState, useEffect, useCallback } from 'react';
import { PluginCard } from './components/PluginCard';
import { PermissionDialog } from './components/PermissionDialog';
import { useIpc } from '../../shared/hooks';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { PluginRegistryEntry } from '@shared/types';
import '../../shared/styles/globals.css';

export default function App() {
  const { invoke } = useIpc();
  const [plugins, setPlugins] = useState<PluginRegistryEntry[]>([]);
  const [dialog, setDialog] = useState<{
    name: string;
    permissions: string[];
    level: number;
  } | null>(null);

  const fetchPlugins = useCallback(async () => {
    try {
      const list = await invoke<PluginRegistryEntry[]>(IPC_CHANNELS.PLUGIN_LIST);
      if (list) setPlugins(list);
    } catch { /* ignore */ }
  }, [invoke]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handleToggle = async (name: string, active: boolean) => {
    const channel = active ? IPC_CHANNELS.PLUGIN_ENABLE : IPC_CHANNELS.PLUGIN_DISABLE;
    await invoke(channel, { name });
    fetchPlugins();
  };

  const handleUninstall = async (name: string) => {
    await invoke(IPC_CHANNELS.PLUGIN_UNINSTALL, { name });
    fetchPlugins();
  };

  const handleInstallLocal = async () => {
    try {
      const result = await invoke<{ name: string; permissions: string[]; level: number }>(
        IPC_CHANNELS.PLUGIN_INSTALL,
        { source: 'local' },
      );
      if (result && result.level >= 2) {
        setDialog(result);
      } else {
        fetchPlugins();
      }
    } catch { fetchPlugins(); }
  };

  const confirmInstall = async () => {
    if (dialog) {
      await invoke(IPC_CHANNELS.PLUGIN_PERMISSION_CHECK, {
        name: dialog.name,
        confirmed: true,
      });
      setDialog(null);
      fetchPlugins();
    }
  };

  return (
    <div className="app plugin-center-app">
      <header className="plugin-center-header">
        <h1>🧩 插件中心</h1>
        <button onClick={handleInstallLocal}>📂 从本地安装</button>
      </header>

      <div className="plugin-list">
        {plugins.length === 0 ? (
          <div className="empty-state">暂无已安装插件</div>
        ) : (
          plugins.map((p) => (
            <PluginCard
              key={p.manifest.name}
              plugin={p}
              onToggle={handleToggle}
              onUninstall={handleUninstall}
              onViewDetails={() => {}}
            />
          ))
        )}
      </div>

      {dialog && (
        <PermissionDialog
          pluginName={dialog.name}
          permissions={dialog.permissions}
          permissionLevel={dialog.level}
          onConfirm={confirmInstall}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
