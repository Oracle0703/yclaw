import { useCallback, useEffect, useState } from 'react';
import { Button, Drawer, Descriptions, Tag, Typography, Divider, Space, message } from 'antd';
import { MinusOutlined, CloseOutlined, SettingOutlined, BorderOutlined } from '@ant-design/icons';
import { useIpc } from '../hooks';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { AppConfig } from '@shared/types';

const TITLE_BAR_HEIGHT = 38;

export function TitleBar() {
  const { invoke } = useIpc();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const reportActionError = (error: unknown, fallbackMessage: string) => {
    message.error(error instanceof Error ? error.message : fallbackMessage);
  };

  const handleMinimize = useCallback(() => {
    void invoke(IPC_CHANNELS.WINDOW_MINIMIZE).catch((error) => {
      reportActionError(error, '最小化窗口失败');
    });
  }, [invoke]);

  const handleMaximize = useCallback(() => {
    void invoke(IPC_CHANNELS.WINDOW_MAXIMIZE).catch((error) => {
      reportActionError(error, '切换窗口状态失败');
    });
  }, [invoke]);

  const handleClose = useCallback(() => {
    void invoke(IPC_CHANNELS.WINDOW_CLOSE).catch((error) => {
      reportActionError(error, '关闭窗口失败');
    });
  }, [invoke]);

  const handleOpenHotMonitor = useCallback(() => {
    window.location.hash = '#/hot-monitor';
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    setConfig(null);
    void invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL)
      .then(setConfig)
      .catch((error) => {
        reportActionError(error, '读取设置失败');
      });
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
        <div className="yclaw-titlebar-left">
          <Button
            className="yclaw-titlebar-hot"
            type="text"
            onClick={handleOpenHotMonitor}
            aria-label="热点"
          >
            热点
          </Button>
        </div>
        <div className="yclaw-titlebar-drag" />
        <div className="yclaw-titlebar-actions">
          <Button
            type="text"
            className="yclaw-titlebar-btn"
            icon={<MinusOutlined />}
            onClick={handleMinimize}
            title="最小化"
            aria-label="最小化"
          />
          <Button
            type="text"
            className="yclaw-titlebar-btn"
            icon={<BorderOutlined />}
            onClick={handleMaximize}
            title="最大化"
            aria-label="最大化"
          />
          <Button
            type="text"
            className="yclaw-titlebar-btn"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
            title="设置"
            aria-label="设置"
          />
          <Button
            type="text"
            danger
            className="yclaw-titlebar-btn yclaw-titlebar-btn-close"
            icon={<CloseOutlined />}
            onClick={handleClose}
            title="关闭"
            aria-label="关闭"
          />
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
