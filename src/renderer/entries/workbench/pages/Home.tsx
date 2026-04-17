import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ArrowUpOutlined,
  DeploymentUnitOutlined,
  FundOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  List,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '../../../shared/components/PageShell';

interface ModuleSummary {
  id: string;
  name: string;
  description: string;
  tag: string;
  status: string;
  icon: ReactNode;
}

interface FlowRecord {
  key: string;
  name: string;
  module: string;
  owner: string;
  status: string;
  progress: number;
  updatedAt: string;
  priority: 'P0' | 'P1' | 'P2';
}

interface AlertItem {
  title: string;
  description: string;
  tag: string;
  severity: 'high' | 'medium' | 'stable';
}

interface TodoItem {
  title: string;
  description: string;
  owner: string;
  level: 'P0' | 'P1';
}

const modules: ModuleSummary[] = [
  {
    id: 'stock',
    name: '股票分析',
    description: '策略面板、指标联动、行情追踪与数据分析。',
    tag: 'Quant',
    status: '行情稳定',
    icon: <FundOutlined style={{ fontSize: 22 }} />,
  },
  {
    id: 'automation',
    name: '自动化采集',
    description: '任务流编排、执行监控与采集日志统一管理。',
    tag: 'RPA',
    status: '队列高峰',
    icon: <RobotOutlined style={{ fontSize: 22 }} />,
  },
  {
    id: 'browser',
    name: '内嵌浏览器',
    description: '多标签页会话、受控导航和脚本注入能力。',
    tag: 'Workspace',
    status: '可扩容',
    icon: <GlobalOutlined style={{ fontSize: 22 }} />,
  },
  {
    id: 'plugin-center',
    name: '插件中心',
    description: '插件安装、权限审核和生命周期编排。',
    tag: 'Extensibility',
    status: '2 个待审',
    icon: <DeploymentUnitOutlined style={{ fontSize: 22 }} />,
  },
];

const recentFlows: FlowRecord[] = [
  {
    key: '1',
    name: 'A 股高波动扫描',
    module: '股票分析',
    owner: '量化小组',
    status: '运行中',
    progress: 78,
    updatedAt: '09:48',
    priority: 'P0',
  },
  {
    key: '2',
    name: '电商竞价监控',
    module: '自动化采集',
    owner: '运营团队',
    status: '待审核',
    progress: 46,
    updatedAt: '10:12',
    priority: 'P1',
  },
  {
    key: '3',
    name: '插件灰度巡检',
    module: '插件中心',
    owner: '平台组',
    status: '已完成',
    progress: 100,
    updatedAt: '10:40',
    priority: 'P2',
  },
  {
    key: '4',
    name: '跨站情报归档',
    module: '内嵌浏览器',
    owner: '情报团队',
    status: '运行中',
    progress: 63,
    updatedAt: '11:05',
    priority: 'P1',
  },
];

const alerts: AlertItem[] = [
  {
    title: '自动化队列负载升高',
    description: '09:30 - 09:45 期间并发任务数升至 18，建议扩容浏览器隔离会话。',
    tag: '容量告警',
    severity: 'high',
  },
  {
    title: '插件权限审批待处理',
    description: '有 2 个待安装插件请求高权限访问，需要管理员确认来源与签名。',
    tag: '权限审批',
    severity: 'medium',
  },
  {
    title: '行情数据连接稳定',
    description: '今日实时连接成功率 99.97%，数据延迟控制在 220ms 内。',
    tag: '服务健康',
    severity: 'stable',
  },
];

const todoItems: TodoItem[] = [
  {
    title: '审批高权限插件',
    description: '来源核验后再开放文件系统与浏览器注入权限。',
    owner: '平台管理员',
    level: 'P0',
  },
  {
    title: '复核 RPA 重试策略',
    description: '高峰时段失败重试次数偏高，建议下调并发并增加退避。',
    owner: '自动化负责人',
    level: 'P1',
  },
  {
    title: '同步行情异常阈值',
    description: '把数据延迟阈值从 300ms 调整到 250ms，以匹配盘中策略。',
    owner: '量化团队',
    level: 'P1',
  },
];

const runtimeProfile = {
  version: 'v1.0.0',
  runtime: 'Electron 33',
  renderer: 'Vite Multi Entry',
  security: 'Plugin Permission Gate',
  sync: 'IPC Config Sync',
  deployment: 'Desktop Ops Console',
};

const resourceUsage = [
  { label: '自动化队列占用', percent: 82, color: '#1677ff' },
  { label: '插件运行资源', percent: 61, color: '#13c2c2' },
  { label: '浏览器会话利用率', percent: 54, color: '#fa8c16' },
];

const kpiCards = [
  {
    title: '今日执行工作流',
    value: '28',
    meta: '较昨日提升 18%',
    icon: <RocketOutlined style={{ fontSize: 20, color: '#1677ff' }} />,
  },
  {
    title: '在线插件',
    value: '12 / 15',
    meta: '3 个待审批',
    icon: <DeploymentUnitOutlined style={{ fontSize: 20, color: '#13c2c2' }} />,
  },
  {
    title: '行情连接',
    value: '99.97%',
    meta: '最近 24h 无中断',
    icon: <ThunderboltOutlined style={{ fontSize: 20, color: '#faad14' }} />,
  },
  {
    title: '权限通过率',
    value: '100%',
    meta: '高风险插件二次确认',
    icon: <SafetyCertificateOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
  },
] as const;

function getModuleId(moduleName: string) {
  const map: Record<string, string> = {
    股票分析: 'stock',
    自动化采集: 'automation',
    内嵌浏览器: 'browser',
    插件中心: 'plugin-center',
  };

  return map[moduleName] ?? 'workbench';
}

export default function Home() {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState<string>('stock');

  const openModule = (moduleId: string) => {
    const routeMap: Record<string, string> = {
      stock: '/stock',
      automation: '/automation',
      browser: '/browser',
      'plugin-center': '/plugin-center',
    };
    navigate(routeMap[moduleId] ?? '/');
  };

  const flowColumns: TableColumnsType<FlowRecord> = [
    {
      title: '工作流',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">
            {record.module} / {record.owner}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (_, record) => (
        <Tag
          color={
            record.priority === 'P0' ? 'error' : record.priority === 'P1' ? 'warning' : 'default'
          }
        >
          {record.priority}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => {
        const color =
          record.status === '运行中'
            ? 'processing'
            : record.status === '已完成'
              ? 'success'
              : 'warning';
        return <Tag color={color}>{record.status}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (_, record) => (
        <Progress percent={record.progress} size="small" strokeColor="#1677ff" />
      ),
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 110,
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      render: (_, record) => (
        <Button type="link" onClick={() => void openModule(getModuleId(record.module))}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title="中台总览"
      subTitle="统一查看数据、流程、插件和浏览器能力的整体运行态势"
      content="以驾驶舱方式汇总执行效率、风险事件与模块资源，用一个工作台完成监控、分析和调度。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Ops</Tag>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新界面
          </Button>
          <Button type="primary" icon={<PlusOutlined />}>
            新建流程
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Card className="yclaw-panel-card yclaw-page-hero">
          <Row gutter={[24, 24]}>
            <Col xs={24} xl={15}>
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color="processing">Ops Cockpit</Tag>
                </Space>
                <div>
                  <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
                    统一承接流程、数据与插件的运营工作台
                  </Typography.Title>
                  <Typography.Paragraph className="yclaw-hero-description">
                    用更轻的管理台布局承接自动化执行、行情分析、浏览器会话与插件治理，减少跳转和信息干扰。
                  </Typography.Paragraph>
                </div>
                <Space wrap size={12} className="yclaw-hero-actions">
                  <Button
                    type="primary"
                    size="large"
                    icon={<RocketOutlined />}
                    onClick={() => void openModule('automation')}
                  >
                    创建执行流程
                  </Button>
                  <Button size="large" onClick={() => void openModule('plugin-center')}>
                    进入插件审批
                  </Button>
                </Space>
              </Space>
            </Col>

            <Col xs={24} xl={9}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div className="yclaw-hero-metric">
                  <div>
                    <Typography.Text type="secondary">执行成功率</Typography.Text>
                    <Typography.Title level={3}>96.8%</Typography.Title>
                  </div>
                  <Tag color="success">
                    <ArrowUpOutlined /> 2.4%
                  </Tag>
                </div>
                <div className="yclaw-hero-metric">
                  <div>
                    <Typography.Text type="secondary">待处理告警</Typography.Text>
                    <Typography.Title level={3}>05</Typography.Title>
                  </div>
                  <Tag color="warning">需要值守</Tag>
                </div>
                <div className="yclaw-hero-metric">
                  <div>
                    <Typography.Text type="secondary">跨模块协同链路</Typography.Text>
                    <Typography.Title level={3}>12</Typography.Title>
                  </div>
                  <Tag color="processing">健康运行</Tag>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          {kpiCards.map((item) => (
            <Col xs={24} sm={12} xl={6} key={item.title}>
              <Card className="yclaw-panel-card yclaw-kpi-card">
                <div className="yclaw-kpi-card-head">
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                  <span className="yclaw-kpi-card-icon">{item.icon}</span>
                </div>
                <Typography.Title level={3} className="yclaw-kpi-card-value">
                  {item.value}
                </Typography.Title>
                <Typography.Text type="secondary">{item.meta}</Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[20, 20]}>
          <Col xs={24} xl={16}>
            <Card
              className="yclaw-panel-card"
              title="核心工作流"
              extra={<Tag color="processing">运行中</Tag>}
            >
              <Table<FlowRecord>
                className="yclaw-compact-table"
                rowKey="key"
                pagination={false}
                size="small"
                columns={flowColumns}
                dataSource={recentFlows}
              />
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            <Card
              className="yclaw-panel-card"
              title="值班面板"
              extra={<Tag color="warning">待处理</Tag>}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <List
                  className="yclaw-signal-list"
                  dataSource={todoItems}
                  renderItem={(item) => (
                    <List.Item className="yclaw-todo-item">
                      <div className="yclaw-signal-item">
                        <div className="yclaw-list-title-row">
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Tag color={item.level === 'P0' ? 'error' : 'warning'}>{item.level}</Tag>
                        </div>
                        <Typography.Paragraph className="yclaw-signal-description">
                          {item.description}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary" className="yclaw-inline-meta">
                          负责人 · {item.owner}
                        </Typography.Text>
                      </div>
                    </List.Item>
                  )}
                />

                <div className="yclaw-panel-section">
                  <Typography.Text strong>运行画像</Typography.Text>
                  <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
                    <Descriptions.Item label="版本">{runtimeProfile.version}</Descriptions.Item>
                    <Descriptions.Item label="运行时">{runtimeProfile.runtime}</Descriptions.Item>
                    <Descriptions.Item label="渲染层">{runtimeProfile.renderer}</Descriptions.Item>
                    <Descriptions.Item label="安全机制">{runtimeProfile.security}</Descriptions.Item>
                    <Descriptions.Item label="配置同步">{runtimeProfile.sync}</Descriptions.Item>
                    <Descriptions.Item label="部署形态">{runtimeProfile.deployment}</Descriptions.Item>
                  </Descriptions>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[20, 20]}>
          <Col xs={24} xl={14}>
            <Card
              className="yclaw-panel-card"
              title="业务模块矩阵"
              extra={<Tag color="processing">4 个模块</Tag>}
            >
              <Row gutter={[16, 16]}>
                {modules.map((item) => (
                  <Col xs={24} sm={12} key={item.id}>
                    <Card
                      hoverable
                      tabIndex={0}
                      className={`yclaw-panel-card yclaw-module-card${selectedModule === item.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setSelectedModule(item.id);
                        void openModule(item.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedModule(item.id);
                          void openModule(item.id);
                        }
                      }}
                    >
                      <Space align="start" size={14}>
                        <span className="yclaw-module-card-icon">{item.icon}</span>
                        <div className="yclaw-module-card-content">
                          <div className="yclaw-list-title-row">
                            <Typography.Text strong>{item.name}</Typography.Text>
                            <Tag color="blue">{item.status}</Tag>
                          </div>
                          <Typography.Text type="secondary" className="yclaw-module-card-meta">
                            {item.tag}
                          </Typography.Text>
                          <Typography.Paragraph className="yclaw-signal-description">
                            {item.description}
                          </Typography.Paragraph>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <Card className="yclaw-panel-card" title="风险与资源">
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <List
                  className="yclaw-signal-list"
                  dataSource={alerts}
                  renderItem={(item) => (
                    <List.Item>
                      <div className="yclaw-signal-item">
                        <div className="yclaw-list-title-row">
                          <span className={`yclaw-signal-dot yclaw-signal-dot-${item.severity}`} />
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Tag
                            color={
                              item.severity === 'high'
                                ? 'error'
                                : item.severity === 'medium'
                                  ? 'warning'
                                  : 'success'
                            }
                          >
                            {item.tag}
                          </Tag>
                        </div>
                        <Typography.Paragraph className="yclaw-signal-description">
                          {item.description}
                        </Typography.Paragraph>
                      </div>
                    </List.Item>
                  )}
                />

                <div className="yclaw-panel-section">
                  <Typography.Text strong>资源利用率</Typography.Text>
                  <Space direction="vertical" size={14} style={{ width: '100%', marginTop: 12 }}>
                    {resourceUsage.map((item) => (
                      <div key={item.label}>
                        <div className="yclaw-resource-row">
                          <Typography.Text>{item.label}</Typography.Text>
                          <Typography.Text type="secondary">{item.percent}%</Typography.Text>
                        </div>
                        <Progress percent={item.percent} showInfo={false} strokeColor={item.color} />
                      </div>
                    ))}
                  </Space>
                </div>

                <div className="yclaw-panel-section">
                  <Space direction="vertical" size={12} className="yclaw-action-stack">
                    <Typography.Text strong>建议动作</Typography.Text>
                    <Button type="primary" block onClick={() => void openModule('plugin-center')}>
                      先处理插件审批
                    </Button>
                    <Button block onClick={() => void openModule('automation')}>
                      再检查自动化队列
                    </Button>
                    <Button block onClick={() => void openModule('stock')}>
                      打开行情监控视图
                    </Button>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>
    </PageShell>
  );
}
