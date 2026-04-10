import { useCallback, useEffect, useState } from 'react';
import { Drawer, Descriptions, Tag, Typography, Divider, Space } from 'antd';
import { MinusOutlined, CloseOutlined, SettingOutlined } from '@ant-design/icons';
import { useIpc } from '../hooks';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { AppConfig } from '@shared/types';

const TITLE_BAR_HEIGHT = 38;

export function TitleBar() {
  const { invoke } = useIpc();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const handleMinimize = useCallback(() => {
    void invoke(IPC_CHANNELS.WINDOW_MINIMIZE);
  }, [invoke]);

  const handleClose = useCallback(() => {
    void invoke(IPC_CHANNELS.WINDOW_CLOSE);
  }, [invoke]);

  useEffect(() => {
    if (!settingsOpen) return;
    void invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL)
      .then(setConfig)
      .catch(() => {});
  }, [settingsOpen, invoke]);

  const themeLabel = { light: '亮色', dark: '暗色', system: '跟随系统' } as const;
  const startupLabel = {
    showWorkbench: '显示工作台',
    restoreLastSession: '恢复上次会话',
    minimizeToTray: '最小化到托盘',
  } as const;

  return (
    <>
      <div className="yclaw-titlebar" style={{ height: TITLE_BAR_HEIGHT }}>
        <div className="yclaw-titlebar-drag" />
        <div className="yclaw-titlebar-actions">
          <button className="yclaw-titlebar-btn" onClick={handleMinimize} title="最小化">
            <MinusOutlined />
          </button>
          <button className="yclaw-titlebar-btn" onClick={() => setSettingsOpen(true)} title="设置">
            <SettingOutlined />
          </button>
          <button
            className="yclaw-titlebar-btn yclaw-titlebar-btn-close"
            onClick={handleClose}
            title="关闭"
          >
            <CloseOutlined />
          </button>
        </div>
      </div>

      <Drawer
        title="应用设置"
        placement="right"
        width={420}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        className="yclaw-settings-drawer"
      >
        {config ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Typography.Title level={5}>常规设置</Typography.Title>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="主题">
                  <Tag color="blue">{themeLabel[config.general.theme] ?? config.general.theme}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="语言">
                  {config.general.language || 'zh-CN'}
                </Descriptions.Item>
                <Descriptions.Item label="启动行为">
                  {startupLabel[config.general.startupBehavior] ?? config.general.startupBehavior}
                </Descriptions.Item>
                <Descriptions.Item label="关闭到托盘">
                  <Tag color={config.general.closeToTray ? 'green' : 'default'}>
                    {config.general.closeToTray ? '是' : '否'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>

            <Divider style={{ margin: 0 }} />

            <div>
              <Typography.Title level={5}>模块配置</Typography.Title>
              {Object.keys(config.modules).length > 0 ? (
                <Descriptions bordered column={1} size="small">
                  {Object.entries(config.modules).map(([name, mod]) => (
                    <Descriptions.Item key={name} label={name}>
                      <Tag color={mod.enabled ? 'green' : 'default'}>
                        {mod.enabled ? '已启用' : '已禁用'}
                      </Tag>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              ) : (
                <Typography.Text type="secondary">暂无模块配置</Typography.Text>
              )}
            </div>

            <Divider style={{ margin: 0 }} />

            <div>
              <Typography.Title level={5}>插件配置</Typography.Title>
              {Object.keys(config.plugins).length > 0 ? (
                <Descriptions bordered column={1} size="small">
                  {Object.entries(config.plugins).map(([name, plugin]) => (
                    <Descriptions.Item key={name} label={name}>
                      <Tag color={plugin.enabled ? 'green' : 'default'}>
                        {plugin.enabled ? '已启用' : '已禁用'}
                      </Tag>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              ) : (
                <Typography.Text type="secondary">暂无插件配置</Typography.Text>
              )}
            </div>
          </Space>
        ) : (
          <Typography.Text type="secondary">正在加载设置...</Typography.Text>
        )}
      </Drawer>
    </>
  );
}
