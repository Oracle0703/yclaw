import { Button, Card, Descriptions, Space, Switch, Tag, Typography } from 'antd';
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
    <Card
      className="yclaw-panel-card"
      title={
        <Space>
          <Typography.Text strong>{manifest.displayName}</Typography.Text>
          <Tag>v{manifest.version}</Tag>
          <Tag color={manifest.permissionLevel >= 2 ? 'warning' : 'blue'}>
            L{manifest.permissionLevel}
          </Tag>
        </Space>
      }
      extra={
        <Space>
          <Typography.Text type="secondary">{isActive ? '已启用' : '已禁用'}</Typography.Text>
          <Switch checked={isActive} onChange={() => onToggle(manifest.name, !isActive)} />
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">{manifest.description}</Typography.Paragraph>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="作者">{manifest.author ?? '未提供'}</Descriptions.Item>
        <Descriptions.Item label="权限">{manifest.permissions.join(', ') || '无'}</Descriptions.Item>
      </Descriptions>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={() => onViewDetails(manifest.name)}>详情</Button>
        <Button danger onClick={() => onUninstall(manifest.name)}>
          卸载
        </Button>
      </Space>
    </Card>
  );
}
