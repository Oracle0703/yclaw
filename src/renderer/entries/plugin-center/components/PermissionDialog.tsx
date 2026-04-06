import { Alert, List, Modal, Tag, Typography } from 'antd';

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
    <Modal
      open
      title="权限确认"
      okText="允许"
      cancelText="取消"
      onOk={onConfirm}
      onCancel={onCancel}
    >
      <Typography.Paragraph>
        插件 <Typography.Text strong>{pluginName}</Typography.Text> 请求以下权限
        <Tag color={permissionLevel >= 3 ? 'error' : 'processing'}>L{permissionLevel}</Tag>
      </Typography.Paragraph>

      <List
        bordered
        dataSource={permissions}
        renderItem={(perm) => <List.Item>{PERMISSION_LABELS[perm] ?? perm}</List.Item>}
      />

      {permissionLevel >= 3 && (
        <Alert
          style={{ marginTop: 16 }}
          type="warning"
          message="该插件请求高级权限，可能访问文件系统或控制自动化引擎。请确认信任来源。"
        />
      )}
    </Modal>
  );
}
