import { useEffect, useRef, useState } from 'react';
import { App as AntdApp, Button, Col, Row, Space, Tag, Typography } from 'antd';
import {
  ProCard,
  ProDescriptions,
  ProForm,
  ProFormSelect,
  ProFormSwitch,
} from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { AppConfig, GeneralConfig } from '@shared/types';
import { useIpc } from '../../../shared/hooks';
import { useThemeMode } from '../../../shared/components/AppProviders';

const DEFAULT_GENERAL_CONFIG: GeneralConfig = {
  theme: 'system',
  language: 'zh-CN',
  startupBehavior: 'showWorkbench',
  closeToTray: false,
};

const themeLabelMap: Record<GeneralConfig['theme'], string> = {
  light: '浅色模式',
  dark: '深色模式',
  system: '跟随系统',
};

const startupLabelMap: Record<GeneralConfig['startupBehavior'], string> = {
  showWorkbench: '打开工作台',
  restoreLastSession: '恢复上次会话',
  minimizeToTray: '最小化到托盘',
};

interface SettingsProps {
  active: boolean;
  preload?: boolean;
}

export default function Settings({ active, preload = false }: SettingsProps) {
  const { invoke } = useIpc();
  const { message } = AntdApp.useApp();
  const { setThemePreference } = useThemeMode();
  const formRef = useRef<ProFormInstance<GeneralConfig>>();
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [currentValues, setCurrentValues] = useState<GeneralConfig>(DEFAULT_GENERAL_CONFIG);

  const loadConfig = async () => {
    const config = await invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL);
    const general = config.general;
    formRef.current?.setFieldsValue(general);
    setCurrentValues(general);
    void setThemePreference(general.theme);
  };

  useEffect(() => {
    if ((!active && !preload) || hasLoadedRef.current) {
      return;
    }

    void (async () => {
      try {
        await loadConfig();
        hasLoadedRef.current = true;
      } catch {
        message.error('读取配置失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [active, invoke, message]);

  const handleReset = async () => {
    try {
      setLoading(true);
      await invoke(IPC_CHANNELS.CONFIG_RESET);
      await loadConfig();
      message.success('已恢复默认设置');
    } catch {
      message.error('恢复默认设置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row gutter={[20, 20]}>
      <Col xs={24} xl={16}>
        <ProCard className="yclaw-panel-card" title="通用配置">
          <ProForm<GeneralConfig>
            formRef={formRef}
            grid
            submitter={false}
            disabled={loading}
            initialValues={DEFAULT_GENERAL_CONFIG}
            onValuesChange={(_, values) => {
              setCurrentValues({ ...DEFAULT_GENERAL_CONFIG, ...values });
            }}
            onFinish={async (values) => {
              await invoke(IPC_CHANNELS.CONFIG_SET, { key: 'general', value: values });
              setCurrentValues(values);
              await setThemePreference(values.theme, { broadcast: true });
              message.success('设置已保存');
              return true;
            }}
          >
            <ProCard
              title="界面偏好"
              type="inner"
              className="yclaw-settings-section"
              extra={<Tag color="processing">Workbench UI</Tag>}
            >
              <ProFormSelect
                colProps={{ xs: 24, md: 12 }}
                name="theme"
                label="主题模式"
                rules={[{ required: true }]}
                options={[
                  { label: '浅色', value: 'light' },
                  { label: '深色', value: 'dark' },
                  { label: '跟随系统', value: 'system' },
                ]}
              />
              <ProFormSelect
                colProps={{ xs: 24, md: 12 }}
                name="language"
                label="界面语言"
                rules={[{ required: true }]}
                options={[
                  { label: '简体中文', value: 'zh-CN' },
                  { label: 'English', value: 'en-US' },
                ]}
              />
            </ProCard>

            <ProCard
              title="启动策略"
              type="inner"
              className="yclaw-settings-section"
              extra={<Tag color="cyan">Desktop Runtime</Tag>}
            >
              <ProFormSelect
                colProps={{ xs: 24 }}
                name="startupBehavior"
                label="启动行为"
                rules={[{ required: true }]}
                options={[
                  { label: '打开工作台', value: 'showWorkbench' },
                  { label: '恢复上次会话', value: 'restoreLastSession' },
                  { label: '最小化到托盘', value: 'minimizeToTray' },
                ]}
              />
              <ProFormSwitch
                colProps={{ xs: 24 }}
                name="closeToTray"
                label="关闭主窗口时缩到托盘"
              />
            </ProCard>

            <Space className="yclaw-settings-submit">
              <Button
                type="primary"
                loading={loading}
                onClick={() => {
                  formRef.current?.submit();
                }}
              >
                保存设置
              </Button>
              <Button onClick={() => void handleReset()}>恢复默认</Button>
            </Space>
          </ProForm>
        </ProCard>
      </Col>

      <Col xs={24} xl={8}>
        <ProCard className="yclaw-panel-card" title="配置画像" split="horizontal">
          <ProCard bordered={false}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              当前生效配置
            </Typography.Title>
            <ProDescriptions
              column={1}
              dataSource={currentValues}
              columns={[
                {
                  title: '主题模式',
                  dataIndex: 'theme',
                  render: (_, record) => themeLabelMap[record.theme],
                },
                {
                  title: '界面语言',
                  dataIndex: 'language',
                },
                {
                  title: '启动行为',
                  dataIndex: 'startupBehavior',
                  render: (_, record) => startupLabelMap[record.startupBehavior],
                },
                {
                  title: '关闭时托盘化',
                  dataIndex: 'closeToTray',
                  render: (_, record) => (record.closeToTray ? '启用' : '关闭'),
                },
              ]}
            />
          </ProCard>
          <ProCard bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className="yclaw-settings-tip">
                <Typography.Text strong>配置说明</Typography.Text>
                <Typography.Paragraph type="secondary">
                  工作台配置保存在主进程侧，适合承载主题、语言、启动策略等全局偏好。
                </Typography.Paragraph>
              </div>
              <div className="yclaw-settings-tip">
                <Typography.Text strong>中台化建议</Typography.Text>
                <Typography.Paragraph type="secondary">
                  后续可以继续补充用户权限、菜单开关、模块白名单和环境配置，实现更完整的后台控制台能力。
                </Typography.Paragraph>
              </div>
            </Space>
          </ProCard>
        </ProCard>
      </Col>
    </Row>
  );
}
