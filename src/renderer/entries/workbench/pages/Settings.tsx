import { useCallback, useEffect, useRef, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type {
  AppConfig,
  GeneralConfig,
  McpClientServerConfig,
  McpClientServerStatus,
} from '@shared/types';
import type { LogEntry } from '@shared/utils';
import { useIpc } from '../../../shared/hooks';
import { useThemeMode } from '../../../shared/components/AppProviders';
import { PageShell } from '../../../shared/components/PageShell';

interface EmbeddedMcpHttpStatus {
  running: boolean;
  host?: string;
  port?: number;
  endpoint?: string;
  authRequired?: boolean;
}

interface EmbeddedMcpHttpConfig {
  host: string;
  port: number;
  token?: string;
}

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

const DEFAULT_MCP_STATUS: EmbeddedMcpHttpStatus = {
  running: false,
  authRequired: true,
};

const DEFAULT_MCP_CONFIG: EmbeddedMcpHttpConfig = {
  host: '127.0.0.1',
  port: 3939,
};

const DEFAULT_MCP_CLIENT_STATUSES: McpClientServerStatus[] = [];
const DEFAULT_MCP_AUDIT_ENTRIES: LogEntry[] = [];

export default function Settings() {
  const { invoke } = useIpc();
  const { message } = AntdApp.useApp();
  const { setThemePreference } = useThemeMode();
  const [form] = Form.useForm<GeneralConfig>();
  const formRef = useRef<FormInstance<GeneralConfig> | null>(null);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [currentValues, setCurrentValues] = useState<GeneralConfig>(DEFAULT_GENERAL_CONFIG);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<EmbeddedMcpHttpStatus>(DEFAULT_MCP_STATUS);
  const [mcpConfig, setMcpConfig] = useState<EmbeddedMcpHttpConfig>(DEFAULT_MCP_CONFIG);
  const [mcpServersText, setMcpServersText] = useState('[]');
  const [mcpClientStatuses, setMcpClientStatuses] = useState<McpClientServerStatus[]>(
    DEFAULT_MCP_CLIENT_STATUSES,
  );
  const [mcpAuditEntries, setMcpAuditEntries] = useState<LogEntry[]>(DEFAULT_MCP_AUDIT_ENTRIES);

  formRef.current = form;

  const loadConfig = useCallback(async () => {
    const config = await invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL);
    const general = config.general;
    formRef.current?.setFieldsValue(general);
    setCurrentValues(general);
    setMcpConfig(normalizeMcpConfig(config.ai?.mcp?.embeddedHttp));
    setMcpServersText(formatMcpServers(config.ai?.mcp?.servers ?? []));
    void setThemePreference(general.theme);
  }, [invoke, setThemePreference]);

  const loadMcpStatus = useCallback(async () => {
    const status = await invoke<EmbeddedMcpHttpStatus>(IPC_CHANNELS.AI_MCP_STATUS);
    setMcpStatus(status ?? DEFAULT_MCP_STATUS);
  }, [invoke]);

  const loadMcpClientStatuses = useCallback(async () => {
    const statuses = await invoke<McpClientServerStatus[]>(IPC_CHANNELS.AI_MCP_CLIENT_STATUS);
    setMcpClientStatuses(Array.isArray(statuses) ? statuses : DEFAULT_MCP_CLIENT_STATUSES);
  }, [invoke]);

  const loadMcpAuditEntries = useCallback(async () => {
    const entries = await invoke<LogEntry[]>(IPC_CHANNELS.AI_MCP_AUDIT_LIST);
    setMcpAuditEntries(Array.isArray(entries) ? entries : DEFAULT_MCP_AUDIT_ENTRIES);
  }, [invoke]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    void (async () => {
      try {
        await Promise.all([loadConfig(), loadMcpStatus(), loadMcpClientStatuses(), loadMcpAuditEntries()]);
        hasLoadedRef.current = true;
      } catch {
        message.error('读取配置失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadConfig, loadMcpStatus, loadMcpClientStatuses, loadMcpAuditEntries, message]);

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

  const handleStartMcp = async () => {
    try {
      setMcpLoading(true);
      const status = await invoke<EmbeddedMcpHttpStatus>(
        IPC_CHANNELS.AI_MCP_START,
        normalizeMcpConfig(mcpConfig),
      );
      setMcpStatus(status ?? DEFAULT_MCP_STATUS);
      message.success('MCP HTTP 服务已启动');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动 MCP HTTP 服务失败');
    } finally {
      setMcpLoading(false);
    }
  };

  const handleSaveMcpConfig = async () => {
    try {
      setMcpLoading(true);
      const nextConfig = normalizeMcpConfig(mcpConfig);
      await invoke(IPC_CHANNELS.AI_CONFIG_SET, {
        mcp: {
          embeddedHttp: nextConfig,
        },
      });
      setMcpConfig(nextConfig);
      message.success('MCP HTTP 配置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存 MCP HTTP 配置失败');
    } finally {
      setMcpLoading(false);
    }
  };

  const handleSaveMcpServers = async () => {
    try {
      setMcpLoading(true);
      const servers = parseMcpServers(mcpServersText);
      await invoke(IPC_CHANNELS.AI_CONFIG_SET, {
        mcp: {
          servers,
        },
      });
      setMcpServersText(formatMcpServers(servers));
      await loadMcpClientStatuses();
      message.success('外部 MCP Servers 配置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存外部 MCP Servers 配置失败');
    } finally {
      setMcpLoading(false);
    }
  };

  const handleStopMcp = async () => {
    try {
      setMcpLoading(true);
      const status = await invoke<EmbeddedMcpHttpStatus>(IPC_CHANNELS.AI_MCP_STOP);
      setMcpStatus(status ?? DEFAULT_MCP_STATUS);
      message.success('MCP HTTP 服务已停止');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '停止 MCP HTTP 服务失败');
    } finally {
      setMcpLoading(false);
    }
  };

  const handleRefreshMcpStatus = async () => {
    try {
      setMcpLoading(true);
      await loadMcpStatus();
      message.success('MCP HTTP 状态已刷新');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '读取 MCP HTTP 状态失败');
    } finally {
      setMcpLoading(false);
    }
  };

  const handleRefreshMcpAudit = async () => {
    try {
      setMcpLoading(true);
      await loadMcpAuditEntries();
      message.success('MCP 审计已刷新');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '读取 MCP 审计失败');
    } finally {
      setMcpLoading(false);
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

              <div className="yclaw-panel-section">
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  Embedded MCP HTTP
                </Typography.Title>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="服务状态">
                      <Tag color={mcpStatus.running ? 'success' : 'default'}>
                        {mcpStatus.running ? '运行中' : '未启动'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="访问端点">
                      {mcpStatus.endpoint ?? 'http://127.0.0.1:3939/mcp'}
                    </Descriptions.Item>
                    <Descriptions.Item label="鉴权要求">
                      {mcpStatus.authRequired === false ? '未启用' : 'Bearer Token'}
                    </Descriptions.Item>
                    <Descriptions.Item label="监听地址">
                      {mcpStatus.host ?? '127.0.0.1'}:{mcpStatus.port ?? 3939}
                    </Descriptions.Item>
                  </Descriptions>

                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text strong>启动配置</Typography.Text>
                    <InputNumber
                      aria-label="MCP HTTP 端口"
                      min={1}
                      max={65535}
                      precision={0}
                      value={mcpConfig.port}
                      onChange={(value) => {
                        setMcpConfig((current) => ({
                          ...current,
                          port: Number(value ?? DEFAULT_MCP_CONFIG.port),
                        }));
                      }}
                    />
                    <Input
                      type="password"
                      placeholder="可选：默认使用 YCLAW_MCP_TOKEN"
                      value={mcpConfig.token ?? ''}
                      onChange={(event) => {
                        setMcpConfig((current) => ({
                          ...current,
                          token: event.target.value,
                        }));
                      }}
                    />
                    <Button loading={mcpLoading} onClick={() => void handleSaveMcpConfig()}>
                      保存 MCP 配置
                    </Button>
                  </Space>

                  <Space>
                    <Button
                      type="primary"
                      loading={mcpLoading}
                      onClick={() => void handleStartMcp()}
                    >
                      启动 MCP 服务
                    </Button>
                    <Button loading={mcpLoading} onClick={() => void handleStopMcp()}>
                      停止 MCP 服务
                    </Button>
                    <Button loading={mcpLoading} onClick={() => void handleRefreshMcpStatus()}>
                      刷新状态
                    </Button>
                  </Space>

                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text strong>外部 MCP Servers</Typography.Text>
                    <Typography.Paragraph type="secondary">
                      使用 JSON 数组配置外部 MCP server，字段包括 id、name、command、args、env、enabled。
                    </Typography.Paragraph>
                    <Input.TextArea
                      rows={8}
                      placeholder="粘贴 MCP servers JSON 数组"
                      value={mcpServersText}
                      onChange={(event) => setMcpServersText(event.target.value)}
                    />
                    <Button loading={mcpLoading} onClick={() => void handleSaveMcpServers()}>
                      保存外部 MCP Servers
                    </Button>

                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Typography.Text strong>外部 MCP Server 状态</Typography.Text>
                      {mcpClientStatuses.length === 0 ? (
                        <Typography.Paragraph type="secondary">
                          暂无外部 MCP Server 状态。
                        </Typography.Paragraph>
                      ) : (
                        mcpClientStatuses.map((status) => (
                          <Card key={status.id} type="inner" title={status.name} size="small">
                            <Descriptions column={1} size="small">
                              <Descriptions.Item label="连接状态">
                                <Tag color={mapMcpClientStatusColor(status.state)}>
                                  {mapMcpClientStatusLabel(status.state)}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="工具数量">
                                {status.toolCount}
                              </Descriptions.Item>
                              {status.lastError ? (
                                <Descriptions.Item label="错误信息">
                                  {status.lastError}
                                </Descriptions.Item>
                              ) : null}
                            </Descriptions>
                          </Card>
                        ))
                      )}
                    </Space>

                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Typography.Text strong>MCP 审计</Typography.Text>
                      <Button loading={mcpLoading} onClick={() => void handleRefreshMcpAudit()}>
                        刷新审计
                      </Button>
                      {mcpAuditEntries.length === 0 ? (
                        <Typography.Paragraph type="secondary">
                          暂无 MCP 审计记录。
                        </Typography.Paragraph>
                      ) : (
                        mcpAuditEntries.map((entry, index) => (
                          <Card
                            key={`${entry.timestamp}-${entry.message}-${index}`}
                            type="inner"
                            size="small"
                            title={entry.message}
                          >
                            <Descriptions column={1} size="small">
                              <Descriptions.Item label="时间">{entry.timestamp}</Descriptions.Item>
                              <Descriptions.Item label="级别">{entry.level}</Descriptions.Item>
                              <Descriptions.Item label="来源">{entry.source}</Descriptions.Item>
                              {entry.data !== undefined ? (
                                <Descriptions.Item label="详情">
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(entry.data, null, 2)}
                                  </pre>
                                </Descriptions.Item>
                              ) : null}
                            </Descriptions>
                          </Card>
                        ))
                      )}
                    </Space>
                  </Space>
                </Space>
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

function normalizeMcpConfig(config?: Partial<EmbeddedMcpHttpConfig>): EmbeddedMcpHttpConfig {
  const port = Number(config?.port ?? DEFAULT_MCP_CONFIG.port);
  const token = config?.token?.trim();

  return {
    host: config?.host?.trim() || DEFAULT_MCP_CONFIG.host,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_MCP_CONFIG.port,
    ...(token ? { token } : {}),
  };
}

function formatMcpServers(servers: McpClientServerConfig[]): string {
  return JSON.stringify(servers, null, 2);
}

function parseMcpServers(value: string): McpClientServerConfig[] {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('外部 MCP Servers 配置必须是 JSON 数组');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`第 ${index + 1} 个 MCP Server 必须是对象`);
    }

    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || record.id.trim().length === 0) {
      throw new Error(`第 ${index + 1} 个 MCP Server 缺少 id`);
    }
    if (typeof record.name !== 'string' || record.name.trim().length === 0) {
      throw new Error(`第 ${index + 1} 个 MCP Server 缺少 name`);
    }
    if (typeof record.command !== 'string' || record.command.trim().length === 0) {
      throw new Error(`第 ${index + 1} 个 MCP Server 缺少 command`);
    }

    return {
      id: record.id.trim(),
      name: record.name.trim(),
      command: record.command.trim(),
      args: Array.isArray(record.args) ? record.args.map(String) : [],
      env: normalizeMcpServerEnv(record.env),
      enabled: record.enabled !== false,
    };
  });
}

function normalizeMcpServerEnv(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, envValue]) => [
      key,
      String(envValue),
    ]),
  );
}

function mapMcpClientStatusLabel(status: McpClientServerStatus['state']): string {
  switch (status) {
    case 'connected':
      return '可用';
    case 'disabled':
      return '已禁用';
    case 'unavailable':
    default:
      return '不可用';
  }
}

function mapMcpClientStatusColor(status: McpClientServerStatus['state']): string {
  switch (status) {
    case 'connected':
      return 'success';
    case 'disabled':
      return 'default';
    case 'unavailable':
    default:
      return 'error';
  }
}
