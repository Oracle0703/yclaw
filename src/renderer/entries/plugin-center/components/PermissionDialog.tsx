import React from 'react';

interface PermissionDialogProps {
  pluginName: string;
  permissions: string[];
  permissionLevel: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const PERMISSION_LABELS: Record<string, string> = {
  ui: 'UI 界面',
  'state:read': '状态读取',
  network: '网络请求',
  storage: '插件存储读写',
  filesystem: '用户文件系统访问',
  automation: '调用自动化引擎',
  webcontents: '操作 WebContentsView',
};

export function PermissionDialog({
  pluginName,
  permissions,
  permissionLevel,
  onConfirm,
  onCancel,
}: PermissionDialogProps) {
  return (
    <div className="permission-dialog-overlay">
      <div className="permission-dialog">
        <h3>权限确认</h3>
        <p>
          插件 <strong>{pluginName}</strong> 请求以下权限（等级 L{permissionLevel}）：
        </p>
        <ul className="permission-list">
          {permissions.map((perm) => (
            <li key={perm}>
              <span className="perm-icon">{permissionLevel >= 3 ? '⚠️' : '🔑'}</span>
              {PERMISSION_LABELS[perm] ?? perm}
            </li>
          ))}
        </ul>
        {permissionLevel >= 3 && (
          <div className="permission-warning">
            ⚠ 该插件请求高级权限，可能访问文件系统或控制自动化引擎。请确认信任来源。
          </div>
        )}
        <div className="dialog-actions">
          <button onClick={onCancel}>取消</button>
          <button className="primary" onClick={onConfirm}>允许</button>
        </div>
      </div>
    </div>
  );
}
