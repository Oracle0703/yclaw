import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '../../../shared/components/PageShell';

const CAPABILITIES = [
  {
    title: '浏览器会话',
    description: '用于任务编辑、登录采集和人工介入。',
    route: '/browser',
    status: '兼容入口',
  },
  {
    title: '插件',
    description: '插件安装、权限审核和生命周期管理。',
    route: '/plugin-center',
    status: '兼容入口',
  },
  {
    title: '数据中心',
    description: 'Data Center 仍保留为结果库增强能力。',
    route: '/data-center',
    status: '兼容入口',
  },
  {
    title: '自动化编辑',
    description: '旧自动化页面保留为通用步骤录制和高级编辑入口。',
    route: '/automation',
    status: '兼容入口',
  },
  {
    title: '京东签到',
    description: '旧自动签到模块保留，任务工具台通过模板调用其服务。',
    route: '/signin',
    status: '模板能力',
  },
];

export default function Capabilities() {
  const navigate = useNavigate();
  return (
    <PageShell title="能力中心">
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div className="taskbench-page-head">
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              能力中心
            </Typography.Title>
            <Typography.Text type="secondary">
              能力中心保留旧模块直达入口，但不再作为一级主流程。
            </Typography.Text>
          </div>
          <Button onClick={() => navigate('/')}>返回任务台</Button>
        </div>

        <Row gutter={[16, 16]}>
          {CAPABILITIES.map((capability) => (
            <Col xs={24} md={12} xl={8} key={capability.title}>
              <Card
                title={
                  <Space>
                    <span>{capability.title}</span>
                    <Tag>{capability.status}</Tag>
                  </Space>
                }
              >
                <Typography.Paragraph type="secondary">{capability.description}</Typography.Paragraph>
                <Button onClick={() => navigate(capability.route)}>打开兼容页</Button>
              </Card>
            </Col>
          ))}
        </Row>
      </Space>
    </PageShell>
  );
}
