import type { ReactNode } from 'react';
import {
  AlertOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  FireOutlined,
  GlobalOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
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

interface OperationMetric {
  title: string;
  value: string;
  meta: string;
  icon: ReactNode;
  tone: 'blue' | 'green' | 'orange' | 'red';
}

interface QuickTaskType {
  key: string;
  title: string;
  description: string;
  route: string;
  tag: string;
  icon: ReactNode;
}

interface RunRecord {
  key: string;
  taskName: string;
  type: string;
  batch: string;
  owner: string;
  status: '运行中' | '需介入' | '已完成' | '排队中';
  progress: number;
  updatedAt: string;
  route: string;
}

interface SignalItem {
  title: string;
  description: string;
  tag: string;
  severity: 'high' | 'medium' | 'stable';
  route: string;
  action: string;
}

interface RunnerHealthItem {
  label: string;
  percent: number;
  description: string;
}

const operationMetrics: OperationMetric[] = [
  {
    title: '任务运行量',
    value: '18',
    meta: '13 成功 / 3 运行中 / 2 需介入',
    tone: 'blue',
    icon: <RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />,
  },
  {
    title: '待处理告警',
    value: '2',
    meta: '1 个登录失效，1 个 Runner 超时',
    tone: 'red',
    icon: <AlertOutlined style={{ fontSize: 20, color: '#ef4444' }} />,
  },
  {
    title: 'Runner 在线',
    value: '4 / 5',
    meta: '本地 1 个，远程 3 个在线',
    tone: 'green',
    icon: <CloudServerOutlined style={{ fontSize: 20, color: '#16a34a' }} />,
  },
  {
    title: '结果入库量',
    value: '326',
    meta: '12 条质量规则命中，3 个报告可导出',
    tone: 'orange',
    icon: <DatabaseOutlined style={{ fontSize: 20, color: '#f59e0b' }} />,
  },
];

const quickTaskTypes: QuickTaskType[] = [
  {
    key: 'hot',
    title: '创建热点采集任务',
    description: '配置平台、关键词、过滤规则和频率，生成热点报告。',
    route: '/hot-monitor',
    tag: '黄金路径',
    icon: <FireOutlined style={{ fontSize: 20 }} />,
  },
  {
    key: 'comment',
    title: '创建评论采集任务',
    description: '选择平台入口、采集限制和 AI 回复语气。',
    route: '/comment-monitor',
    tag: '任务模板',
    icon: <MessageOutlined style={{ fontSize: 20 }} />,
  },
  {
    key: 'signin',
    title: '创建签到巡检任务',
    description: '绑定会话、策略、通知方式和人工介入规则。',
    route: '/signin',
    tag: '任务模板',
    icon: <CheckCircleOutlined style={{ fontSize: 20 }} />,
  },
  {
    key: 'generic',
    title: '创建通用网页采集',
    description: '使用步骤编辑器配置 URL、动作和抽取字段。',
    route: '/automation',
    tag: '通用任务',
    icon: <GlobalOutlined style={{ fontSize: 20 }} />,
  },
];

const activeRuns: RunRecord[] = [
  {
    key: 'run-1',
    taskName: 'AI 行业热点采集',
    type: '热点采集',
    batch: 'batch-hot-20260517-01',
    owner: '内容运营',
    status: '运行中',
    progress: 72,
    updatedAt: '10:18',
    route: '/hot-monitor',
  },
  {
    key: 'run-2',
    taskName: '小红书评论巡检',
    type: '评论采集',
    batch: 'batch-comment-20260517-03',
    owner: '社媒运营',
    status: '需介入',
    progress: 48,
    updatedAt: '10:26',
    route: '/browser',
  },
  {
    key: 'run-3',
    taskName: '京东签到巡检',
    type: '签到巡检',
    batch: 'batch-signin-20260517-01',
    owner: '值班员',
    status: '已完成',
    progress: 100,
    updatedAt: '09:42',
    route: '/signin',
  },
];

const signals: SignalItem[] = [
  {
    title: '评论采集登录态失效',
    description: '小红书评论巡检在二维码登录阶段等待超时，需要值班员进入浏览器现场处理。',
    tag: '需介入',
    severity: 'high',
    route: '/browser',
    action: '进入介入浏览器',
  },
  {
    title: '远程 Runner 心跳延迟',
    description: 'runner-beijing-02 最近一次心跳超过阈值，建议查看任务中心调度面板。',
    tag: 'Runner',
    severity: 'medium',
    route: '/automation',
    action: '处理 Runner 告警',
  },
  {
    title: '热点报告已生成',
    description: 'AI 行业热点采集已产出 HTML 报告和结构化结果，可进入结果中心导出。',
    tag: '结果',
    severity: 'stable',
    route: '/data-center',
    action: '打开热点报告',
  },
];

const runnerHealth: RunnerHealthItem[] = [
  { label: '本地 Runner 可用率', percent: 92, description: '1 个本地执行器在线' },
  { label: '远程 Runner 可用率', percent: 80, description: '3 / 4 个远程执行器在线' },
  { label: '队列消化率', percent: 68, description: '6 个待运行，3 个运行中' },
];

const runtimeProfile = {
  platform: '本地优先',
  spine: 'Task、Batch、Result、Alert、Review、Template',
  firstPath: '热点采集任务',
  deferred: 'Stock / 插件市场 / 云多租户',
};

export default function Home() {
  const navigate = useNavigate();

  const runColumns: TableColumnsType<RunRecord> = [
    {
      title: '任务',
      dataIndex: 'taskName',
      key: 'taskName',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.taskName}</Typography.Text>
          <Typography.Text type="secondary">
            {record.type} / {record.owner}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '批次',
      dataIndex: 'batch',
      key: 'batch',
      render: (_, record) => <Typography.Text copyable>{record.batch}</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const color =
          record.status === '运行中'
            ? 'processing'
            : record.status === '已完成'
              ? 'success'
              : record.status === '需介入'
                ? 'error'
                : 'warning';
        return <Tag color={color}>{record.status}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (_, record) => <Progress percent={record.progress} size="small" />,
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
      width: 120,
      render: (_, record) => (
        <Button type="link" onClick={() => navigate(record.route)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title="任务运营总览"
      subTitle="本地优先的 Web 任务运营平台"
      content="围绕 Task -> Batch -> Result -> Alert -> Review -> Template，把采集、监控、介入、结果和复盘组织成一条可持续运营的主线。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="geekblue">Task Ops</Tag>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新界面
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hot-monitor')}>
            创建热点采集任务
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        {operationMetrics.map((metric) => (
          <Col xs={24} sm={12} xl={6} key={metric.title}>
            <Card className={`yclaw-ops-metric yclaw-ops-metric-${metric.tone}`}>
              <Space align="start" size={12}>
                <span className="yclaw-ops-metric-icon">{metric.icon}</span>
                <Space direction="vertical" size={2}>
                  <Typography.Text type="secondary">{metric.title}</Typography.Text>
                  <Typography.Title level={3}>{metric.value}</Typography.Title>
                  <Typography.Text type="secondary">{metric.meta}</Typography.Text>
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={16}>
          <Card
            title="今日任务运行"
            extra={
              <Button type="link" onClick={() => navigate('/automation')}>
                查看任务中心
              </Button>
            }
          >
            <Table
              className="yclaw-compact-table"
              rowKey="key"
              columns={runColumns}
              dataSource={activeRuns}
              pagination={false}
            />
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card title="快速创建任务">
            <List
              className="yclaw-signal-list"
              dataSource={quickTaskTypes}
              renderItem={(item) => (
                <List.Item key={item.key} className="yclaw-todo-item">
                  <div className="yclaw-signal-item">
                    <div className="yclaw-list-title-row">
                      <span className="yclaw-module-card-icon">{item.icon}</span>
                      <Typography.Text strong>{item.title}</Typography.Text>
                      <Tag color={item.tag === '黄金路径' ? 'geekblue' : 'default'}>{item.tag}</Tag>
                    </div>
                    <Typography.Paragraph className="yclaw-signal-description">
                      {item.description}
                    </Typography.Paragraph>
                    <Button type="link" onClick={() => navigate(item.route)}>
                      {item.title}
                    </Button>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={9}>
          <Card title="需处理告警">
            <List
              className="yclaw-signal-list"
              dataSource={signals}
              renderItem={(item) => (
                <List.Item key={item.title} className="yclaw-todo-item">
                  <div className="yclaw-signal-item">
                    <div className="yclaw-list-title-row">
                      <span className={`yclaw-signal-dot yclaw-signal-dot-${item.severity}`} />
                      <Typography.Text strong>{item.title}</Typography.Text>
                      <Tag>{item.tag}</Tag>
                    </div>
                    <Typography.Paragraph className="yclaw-signal-description">
                      {item.description}
                    </Typography.Paragraph>
                    <Button type="link" onClick={() => navigate(item.route)}>
                      {item.action}
                    </Button>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card title="Runner 健康">
            {runnerHealth.map((item) => (
              <div key={item.label} className="yclaw-resource-block">
                <div className="yclaw-resource-row">
                  <Typography.Text>{item.label}</Typography.Text>
                  <Typography.Text type="secondary">{item.percent}%</Typography.Text>
                </div>
                <Progress percent={item.percent} showInfo={false} />
                <Typography.Text type="secondary">{item.description}</Typography.Text>
              </div>
            ))}
            <Button type="link" icon={<ThunderboltOutlined />} onClick={() => navigate('/automation')}>
              查看调度面板
            </Button>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card title="最近结果">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="最新报告">AI 行业热点日报</Descriptions.Item>
              <Descriptions.Item label="质量问题">12 条结果命中质量规则</Descriptions.Item>
              <Descriptions.Item label="出口状态">3 个报告可导出，1 个 Webhook 待重试</Descriptions.Item>
            </Descriptions>
            <Space wrap>
              <Button
                icon={
                  <span aria-hidden="true">
                    <DatabaseOutlined />
                  </span>
                }
                onClick={() => navigate('/data-center')}
              >
                查看结果中心
              </Button>
              <Button icon={<ApiOutlined />} onClick={() => navigate('/data-center')}>
                配置出口
              </Button>
            </Space>
          </Card>

          <Card title="AI 复盘建议" style={{ marginTop: 16 }}>
            <Typography.Paragraph className="yclaw-signal-description">
              建议先处理“小红书评论巡检”的登录态失效，再把本次处置记录沉淀为复盘和模板修复动作。
            </Typography.Paragraph>
            <Button icon={<ClockCircleOutlined />} onClick={() => navigate('/automation')}>
              打开复盘面板
            </Button>
          </Card>
        </Col>
      </Row>

      <Card title="收敛边界" style={{ marginTop: 16 }}>
        <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
          <Descriptions.Item label="平台定位">{runtimeProfile.platform}</Descriptions.Item>
          <Descriptions.Item label="主线对象">{runtimeProfile.spine}</Descriptions.Item>
          <Descriptions.Item label="首个黄金路径">{runtimeProfile.firstPath}</Descriptions.Item>
          <Descriptions.Item label="暂缓方向">{runtimeProfile.deferred}</Descriptions.Item>
        </Descriptions>
      </Card>
    </PageShell>
  );
}
