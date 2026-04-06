import React from 'react';
import type { PluginRegistryEntry } from '@shared/types';

interface PluginCardProps {
  plugin: PluginRegistryEntry;
  onToggle: (name: string, active: boolean) => void;
  onUninstall: (name: string) => void;
  onViewDetails: (name: string) => void;
}

export function PluginCard({ plugin, onToggle, onUninstall, onViewDetails }: PluginCardProps) {
  const { manifest, status } = plugin;
  const isActive = status === 'active';

  return (
    <div className={`plugin-card plugin-${status}`}>
      <div className="plugin-card-header">
        <h3 className="plugin-name">{manifest.displayName}</h3>
        <span className="plugin-version">v{manifest.version}</span>
        <span className={`plugin-level level-${manifest.permissionLevel}`}>
          L{manifest.permissionLevel}
        </span>
      </div>
      <p className="plugin-desc">{manifest.description}</p>
      {manifest.author && <span className="plugin-author">by {manifest.author}</span>}
      <div className="plugin-card-actions">
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={isActive}
            onChange={() => onToggle(manifest.name, !isActive)}
          />
          <span>{isActive ? '已启用' : '已禁用'}</span>
        </label>
        <button onClick={() => onViewDetails(manifest.name)}>详情</button>
        <button className="danger" onClick={() => onUninstall(manifest.name)}>
          卸载
        </button>
      </div>
    </div>
  );
}
