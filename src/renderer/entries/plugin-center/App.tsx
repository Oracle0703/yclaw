import { useCallback, useEffect, useState } from 'react';
import { Button, Col, Descriptions, Modal, Row, Space, Tag, Typography, message } from 'antd';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { PluginRegistryEntry } from '@shared/types';
import { PageShell } from '../../shared/components/PageShell';
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

  const reportActionError = (error: unknown, fallbackMessage: string) => {
    message.error(error instanceof Error ? error.message : fallbackMessage);
  };

  const fetchPlugins = useCallback(async () => {
    try {
      const list = await invoke<PluginRegistryEntry[]>(IPC_CHANNELS.PLUGIN_LIST);
      setPlugins(list ?? []);
    } catch (error) {
      reportActionError(error, '读取插件列表失败');
    }
  }, [invoke]);

  useEffect(() => {
    void fetchPlugins();
  }, [fetchPlugins]);

  const handleToggle = async (name: string, active: boolean) => {
    const channel = active ? IPC_CHANNELS.PLUGIN_ENABLE : IPC_CHANNELS.PLUGIN_DISABLE;
    try {
      await invoke(channel, { name });
      await fetchPlugins();
    } catch (error) {
      reportActionError(error, '切换插件状态失败');
    }
  };

  const handleUninstall = (name: string) => {
    Modal.confirm({
      title: '确认卸载插件？',
      content: `卸载 ${name} 会移除本地插件文件，此操作不可直接撤销。`,
      okText: '卸载',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await invoke(IPC_CHANNELS.PLUGIN_UNINSTALL, { name, confirmed: true });
          await fetchPlugins();
        } catch (error) {
          reportActionError(error, '卸载插件失败');
        }
      },
    });
  };

  const handleInstallLocal = async () => {
    try {
      const result = await invoke<{
        name: string;
        permissions: string[];
        level: number;
        requiresConfirmation?: boolean;
      } | null>(
        IPC_CHANNELS.PLUGIN_INSTALL,
        { source: 'local' },
      );
      if (result?.requiresConfirmation) {
        setDialog(result);
      } else {
        await fetchPlugins();
      }
    } catch (error) {
      reportActionError(error, '安装插件失败');
      await fetchPlugins();
    }
  };

  const confirmInstall = async () => {
    if (dialog) {
      try {
        await invoke(IPC_CHANNELS.PLUGIN_PERMISSION_CHECK, {
          name: dialog.name,
          confirmed: true,
        });
        setDialog(null);
        await fetchPlugins();
      } catch (error) {
        reportActionError(error, '确认插件权限失败');
      }
    }
  };

  const activePlugins = plugins.filter((plugin) => plugin.status === 'active').length;
  const highRiskPlugins = plugins.filter((plugin) => plugin.manifest.permissionLevel >= 2).length;
  const pluginKpis = [
    { title: '已安装插件', value: `${plugins.length}` },
    { title: '启用中', value: `${activePlugins}` },
    { title: '高权限插件', value: `${highRiskPlugins}` },
  ] as const;

  return (
    <PageShell
      title="插件中心"
      subTitle="管理插件接入、权限分级和启停状态"
      content="采用中台式插件运营页，聚合插件统计、权限审批和插件详情，便于统一审核和灰度发布。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Plugins</Tag>
          <Button icon={<DownloadOutlined />}>同步市场</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void handleInstallLocal()}>
            从本地安装
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          {pluginKpis.map((item) => (
            <Col xs={24} md={8} key={item.title}>
              <ProCard className="yclaw-panel-card yclaw-kpi-card" bordered={false}>
                <div className="yclaw-kpi-card-head">
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                </div>
                <Typography.Title level={3} className="yclaw-kpi-card-value">
                  {item.value}
                </Typography.Title>
              </ProCard>
            </Col>
          ))}
        </Row>

        <ProCard className="yclaw-panel-card" title="插件编排视图">
          <Row gutter={[16, 16]}>
            {plugins.length === 0 ? (
              <Col span={24}>
                <ProCard className="yclaw-empty-state-card">暂无已安装插件</ProCard>
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
    </PageShell>
  );
}
