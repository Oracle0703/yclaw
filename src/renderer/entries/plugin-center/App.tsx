import { useEffect, useState } from 'react';
import { Button, Col, Descriptions, Modal, Row, Space, Tag } from 'antd';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { PluginRegistryEntry } from '@shared/types';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import { useIpc } from '../../shared/hooks';
import { PermissionDialog } from './components/PermissionDialog';
import { PluginCard } from './components/PluginCard';

export default function App() {
  const { invoke } = useIpc();
  const [plugins, setPlugins] = useState<PluginRegistryEntry[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginRegistryEntry | null>(null);
  const [dialog, setDialog] = useState<{
    name: string;
    permissions: string[];
    level: number;
  } | null>(null);

  const fetchPlugins = async () => {
    try {
      const list = await invoke<PluginRegistryEntry[]>(IPC_CHANNELS.PLUGIN_LIST);
      setPlugins(list ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    void fetchPlugins();
  }, []);

  const handleToggle = async (name: string, active: boolean) => {
    const channel = active ? IPC_CHANNELS.PLUGIN_ENABLE : IPC_CHANNELS.PLUGIN_DISABLE;
    await invoke(channel, { name });
    await fetchPlugins();
  };

  const handleUninstall = async (name: string) => {
    await invoke(IPC_CHANNELS.PLUGIN_UNINSTALL, { name });
    await fetchPlugins();
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
        await fetchPlugins();
      }
    } catch {
      await fetchPlugins();
    }
  };

  const confirmInstall = async () => {
    if (dialog) {
      await invoke(IPC_CHANNELS.PLUGIN_PERMISSION_CHECK, {
        name: dialog.name,
        confirmed: true,
      });
      setDialog(null);
      await fetchPlugins();
    }
  };

  const activePlugins = plugins.filter((plugin) => plugin.status === 'active').length;
  const highRiskPlugins = plugins.filter((plugin) => plugin.manifest.permissionLevel >= 2).length;

  return (
    <AdminPageLayout
      currentPath="/plugin-center"
      title="插件中心"
      subTitle="管理插件接入、权限分级和启停状态"
      content="采用中台式插件运营页，聚合插件统计、权限审批和插件详情，便于统一审核和灰度发布。"
      extra={
        <Space>
          <Tag color="processing">Plugin Ops</Tag>
          <Button icon={<DownloadOutlined />}>同步市场</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void handleInstallLocal()}>
            从本地安装
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <StatisticCard.Group direction="row">
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{ title: '已安装插件', value: plugins.length, suffix: '个' }}
          />
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{ title: '启用中', value: activePlugins, suffix: '个' }}
          />
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{ title: '高权限插件', value: highRiskPlugins, suffix: '个' }}
          />
        </StatisticCard.Group>

        <ProCard className="yclaw-panel-card" title="插件编排视图">
          <Row gutter={[16, 16]}>
            {plugins.length === 0 ? (
              <Col span={24}>
                <ProCard>暂无已安装插件</ProCard>
              </Col>
            ) : (
              plugins.map((plugin) => (
                <Col xs={24} lg={12} key={plugin.manifest.name}>
                  <PluginCard
                    plugin={plugin}
                    onToggle={handleToggle}
                    onUninstall={handleUninstall}
                    onViewDetails={() => setSelectedPlugin(plugin)}
                  />
                </Col>
              ))
            )}
          </Row>
        </ProCard>
      </Space>

      <Modal
        open={selectedPlugin !== null}
        title={selectedPlugin?.manifest.displayName}
        footer={null}
        onCancel={() => setSelectedPlugin(null)}
      >
        {selectedPlugin && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="插件名">{selectedPlugin.manifest.name}</Descriptions.Item>
            <Descriptions.Item label="版本">{selectedPlugin.manifest.version}</Descriptions.Item>
            <Descriptions.Item label="状态">{selectedPlugin.status}</Descriptions.Item>
            <Descriptions.Item label="权限等级">
              L{selectedPlugin.manifest.permissionLevel}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {selectedPlugin.manifest.description}
            </Descriptions.Item>
            <Descriptions.Item label="权限">
              {selectedPlugin.manifest.permissions.join(', ')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {dialog && (
        <PermissionDialog
          pluginName={dialog.name}
          permissions={dialog.permissions}
          permissionLevel={dialog.level}
          onConfirm={confirmInstall}
          onCancel={() => setDialog(null)}
        />
      )}
    </AdminPageLayout>
  );
}
