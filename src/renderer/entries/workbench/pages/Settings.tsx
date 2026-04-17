import { useCallback, useEffect, useRef, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { AppConfig, GeneralConfig } from '@shared/types';
import { useIpc } from '../../../shared/hooks';
import { useThemeMode } from '../../../shared/components/AppProviders';
import { PageShell } from '../../../shared/components/PageShell';

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

export default function Settings() {
  const { invoke } = useIpc();
  const { message } = AntdApp.useApp();
  const { setThemePreference } = useThemeMode();
  const [form] = Form.useForm<GeneralConfig>();
  const formRef = useRef<FormInstance<GeneralConfig> | null>(null);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [currentValues, setCurrentValues] = useState<GeneralConfig>(DEFAULT_GENERAL_CONFIG);

  formRef.current = form;

  const loadConfig = useCallback(async () => {
    const config = await invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL);
    const general = config.general;
    formRef.current?.setFieldsValue(general);
    setCurrentValues(general);
    void setThemePreference(general.theme);
  }, [invoke, setThemePreference]);

  useEffect(() => {
    if (hasLoadedRef.current) {
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
  }, [loadConfig, message]);

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
    <PageShell
      title="设置中心"
      subTitle="维护工作台的基础配置、启动策略和模块偏好"
      content="配置将通过 IPC 持久化到主进程侧，用于同步桌面工作台的启动模式、语言和运行偏好。"
    >
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={16}>
          <Card className="yclaw-panel-card" title="通用配置">
            <Form<GeneralConfig>
              form={form}
              layout="vertical"
              disabled={loading}
              initialValues={DEFAULT_GENERAL_CONFIG}
              onValuesChange={(_, values) => {
                setCurrentValues({ ...DEFAULT_GENERAL_CONFIG, ...values });
              }}
              onFinish={async (values) => {
                const nextValues = { ...DEFAULT_GENERAL_CONFIG, ...values };

                try {
                  await invoke(IPC_CHANNELS.CONFIG_SET, { key: 'general', value: nextValues });
                  setCurrentValues(nextValues);
                  await setThemePreference(nextValues.theme, { broadcast: true });
                  message.success('设置已保存');
                  return true;
                } catch (error) {
                  message.error(error instanceof Error ? error.message : '保存设置失败');
                  return false;
                }
              }}
            >
              <Card
                type="inner"
                title="界面偏好"
                className="yclaw-settings-section"
                extra={<Tag color="processing">界面</Tag>}
              >
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item name="theme" label="主题模式" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { label: '浅色', value: 'light' },
                          { label: '深色', value: 'dark' },
                          { label: '跟随系统', value: 'system' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="language" label="界面语言" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { label: '简体中文', value: 'zh-CN' },
                          { label: 'English', value: 'en-US' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card
                type="inner"
                title="启动策略"
                className="yclaw-settings-section"
                extra={<Tag color="cyan">启动</Tag>}
              >
                <Form.Item name="startupBehavior" label="启动行为" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { label: '打开工作台', value: 'showWorkbench' },
                      { label: '恢复上次会话', value: 'restoreLastSession' },
                      { label: '最小化到托盘', value: 'minimizeToTray' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="closeToTray"
                  label="关闭主窗口时缩到托盘"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Card>

              <Space className="yclaw-settings-submit">
                <Button
                  type="primary"
                  loading={loading}
                  onClick={() => {
                    void formRef.current?.submit();
                  }}
                >
                  保存设置
                </Button>
                <Button onClick={() => void handleReset()}>恢复默认</Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card className="yclaw-panel-card" title="配置画像">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div className="yclaw-panel-section">
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  当前生效配置
                </Typography.Title>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="主题模式">
                    {themeLabelMap[currentValues.theme]}
                  </Descriptions.Item>
                  <Descriptions.Item label="界面语言">{currentValues.language}</Descriptions.Item>
                  <Descriptions.Item label="启动行为">
                    {startupLabelMap[currentValues.startupBehavior]}
                  </Descriptions.Item>
                  <Descriptions.Item label="关闭时托盘化">
                    {currentValues.closeToTray ? '启用' : '关闭'}
                  </Descriptions.Item>
                </Descriptions>
              </div>

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
          </Card>
        </Col>
      </Row>
    </PageShell>
  );
}
