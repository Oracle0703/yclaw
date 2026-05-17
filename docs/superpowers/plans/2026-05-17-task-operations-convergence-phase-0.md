# Task Operations Convergence Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the existing workbench from a module showcase into a task operations command center without adding new IPC or backend behavior.

**Architecture:** Phase 0 is a product-information-architecture slice. It updates navigation priority, workbench homepage content, and tests so the UI consistently presents YClaw as a local-first Web task operations platform centered on Task, Batch, Runner, Alert, Result, Review, and Template. Existing routes stay available; lower-priority modules are de-emphasized in copy and menu order rather than removed.

**Tech Stack:** Electron renderer, React 18, React Router, Ant Design, Ant Design icons, Vitest, Testing Library.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/renderer/shared/components/AdminPageLayout.tsx` | Sidebar navigation order, labels, selected title, and header tags |
| `src/renderer/entries/workbench/pages/Home.tsx` | Task operations overview, quick task entry points, active runs, alerts, Runner health, result handoff, AI guidance |
| `src/renderer/entries/workbench/styles.css` | Workbench overview layout styling using existing card/table/list conventions |
| `tests/unit/components/AdminPageLayout.test.tsx` | Locks navigation priority and renamed labels |
| `tests/unit/components/Home.test.tsx` | Locks homepage product positioning and key actions |

## Implementation Notes

| Constraint | Decision |
| --- | --- |
| No backend changes | Use static overview fixtures in `Home.tsx`, matching current page style |
| No new routes | Reuse existing `/automation`, `/hot-monitor`, `/comment-monitor`, `/signin`, `/data-center`, `/browser`, `/plugin-center`, `/stock` routes |
| No module removal | Stock and Plugin remain reachable but are labeled lower priority / Labs / extensions |
| Component scope | Keep Phase 0 in existing files; avoid premature extraction until real data wiring begins |
| React performance | Hoist static arrays and route maps outside components; keep only the necessary selected task type state |

---

### Task 1: Lock Navigation Convergence Tests

**Files:**
- Modify: `tests/unit/components/AdminPageLayout.test.tsx`

- [ ] **Step 1: Update icon mocks for the new navigation icons**

Replace the current `vi.mock('@ant-design/icons', ...)` block with:

```tsx
vi.mock('@ant-design/icons', () => ({
  BarsOutlined: () => <span>bars</span>,
  CheckCircleOutlined: () => <span>check-circle</span>,
  ClusterOutlined: () => <span>cluster</span>,
  DatabaseOutlined: () => <span>database</span>,
  DeploymentUnitOutlined: () => <span>deployment</span>,
  ExperimentOutlined: () => <span>experiment</span>,
  FireOutlined: () => <span>fire</span>,
  GlobalOutlined: () => <span>global</span>,
  HomeOutlined: () => <span>home</span>,
  MenuFoldOutlined: () => <span>fold</span>,
  MenuUnfoldOutlined: () => <span>unfold</span>,
  MessageOutlined: () => <span>message</span>,
  NotificationOutlined: () => <span>notification</span>,
  RobotOutlined: () => <span>robot</span>,
  SafetyCertificateOutlined: () => <span>safety</span>,
  SettingOutlined: () => <span>setting</span>,
}));
```

- [ ] **Step 2: Replace standalone-module navigation tests with task-operation labels**

Replace the three tests named:

```tsx
it('renders the auto sign-in menu and navigates to the standalone page', ...)
it('renders the hot monitor menu and navigates to the standalone page', ...)
it('renders the comment monitor menu and navigates to the standalone page', ...)
```

with:

```tsx
it('prioritizes task operations navigation and keeps task templates reachable', () => {
  render(
    <AdminPageLayout>
      <div>content</div>
    </AdminPageLayout>,
  );

  fireEvent.click(screen.getByRole('button', { name: '任务中心' }));
  expect(navigateMock).toHaveBeenCalledWith('/automation');

  fireEvent.click(screen.getByRole('button', { name: '热点任务' }));
  expect(navigateMock).toHaveBeenCalledWith('/hot-monitor');

  fireEvent.click(screen.getByRole('button', { name: '评论任务' }));
  expect(navigateMock).toHaveBeenCalledWith('/comment-monitor');

  fireEvent.click(screen.getByRole('button', { name: '签到任务' }));
  expect(navigateMock).toHaveBeenCalledWith('/signin');
});

it('keeps secondary modules reachable as operations support surfaces', () => {
  render(
    <AdminPageLayout>
      <div>content</div>
    </AdminPageLayout>,
  );

  fireEvent.click(screen.getByRole('button', { name: '结果中心' }));
  expect(navigateMock).toHaveBeenCalledWith('/data-center');

  fireEvent.click(screen.getByRole('button', { name: '介入浏览器' }));
  expect(navigateMock).toHaveBeenCalledWith('/browser');

  fireEvent.click(screen.getByRole('button', { name: '能力扩展' }));
  expect(navigateMock).toHaveBeenCalledWith('/plugin-center');

  fireEvent.click(screen.getByRole('button', { name: 'Labs' }));
  expect(navigateMock).toHaveBeenCalledWith('/stock');
});
```

- [ ] **Step 3: Update selected-title test to the new hot task label**

In `it('keeps navigation chrome compact with title only', ...)`, keep `locationState.pathname = '/hot-monitor';` and replace:

```tsx
expect(screen.getAllByText('热点监控').length).toBeGreaterThan(0);
```

with:

```tsx
expect(screen.getAllByText('热点任务').length).toBeGreaterThan(0);
```

- [ ] **Step 4: Add a header tag assertion**

In `it('moves navigation controls to the sidebar footer without a hot entry in the content header', ...)`, add:

```tsx
expect(screen.getByText('任务运营')).toBeDefined();
expect(screen.getByText('本地优先')).toBeDefined();
```

- [ ] **Step 5: Run the focused test and verify it fails**

Run:

```bash
npm test -- tests/unit/components/AdminPageLayout.test.tsx
```

Expected before implementation: FAIL because the menu still contains old labels such as `自动化`, `热点监控`, `评论监控`, `自动签到`, `数据中心`, `浏览器`, `插件`, and `行情分析`.

---

### Task 2: Implement Navigation Repositioning

**Files:**
- Modify: `src/renderer/shared/components/AdminPageLayout.tsx`
- Test: `tests/unit/components/AdminPageLayout.test.tsx`

- [ ] **Step 1: Update icon imports**

Replace the existing import list from `@ant-design/icons` with:

```tsx
import {
  BarsOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FireOutlined,
  GlobalOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
```

- [ ] **Step 2: Replace `MODULE_MENU` with task-operation ordering**

Replace the current `MODULE_MENU` array with:

```tsx
const MODULE_MENU: ModuleMenuItem[] = [
  {
    key: '/',
    label: '运营总览',
    icon: <HomeOutlined />,
  },
  {
    key: '/automation',
    label: '任务中心',
    icon: <RobotOutlined />,
  },
  {
    key: '/hot-monitor',
    label: '热点任务',
    icon: <FireOutlined />,
  },
  {
    key: '/comment-monitor',
    label: '评论任务',
    icon: <MessageOutlined />,
  },
  {
    key: '/signin',
    label: '签到任务',
    icon: <CheckCircleOutlined />,
  },
  {
    key: '/data-center',
    label: '结果中心',
    icon: <DatabaseOutlined />,
  },
  {
    key: '/browser',
    label: '介入浏览器',
    icon: <GlobalOutlined />,
  },
  {
    key: '/plugin-center',
    label: '能力扩展',
    icon: <DeploymentUnitOutlined />,
  },
  {
    key: '/stock',
    label: 'Labs',
    icon: <ExperimentOutlined />,
  },
  {
    key: '/settings',
    label: '设置',
    icon: <SettingOutlined />,
  },
];
```

- [ ] **Step 3: Replace the header tags**

In the header action area, replace:

```tsx
<Tag color="cyan">
  <SafetyCertificateOutlined /> 安全
</Tag>
<Tag color="geekblue">
  <BarsOutlined /> 协同
</Tag>
```

with:

```tsx
<Tag color="geekblue">
  <ClusterOutlined /> 任务运营
</Tag>
<Tag color="cyan">
  <SafetyCertificateOutlined /> 本地优先
</Tag>
<Tag color="purple">
  <BarsOutlined /> 可复盘
</Tag>
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- tests/unit/components/AdminPageLayout.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit navigation changes**

Run:

```bash
git add src/renderer/shared/components/AdminPageLayout.tsx tests/unit/components/AdminPageLayout.test.tsx
git commit -m "feat: converge workbench navigation"
```

---

### Task 3: Add Home Page Convergence Tests

**Files:**
- Create: `tests/unit/components/Home.test.tsx`

- [ ] **Step 1: Create the test file**

Create `tests/unit/components/Home.test.tsx` with:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock('@ant-design/icons', () => ({
  AlertOutlined: () => <span>alert</span>,
  ApiOutlined: () => <span>api</span>,
  CheckCircleOutlined: () => <span>check-circle</span>,
  ClockCircleOutlined: () => <span>clock</span>,
  CloudServerOutlined: () => <span>cloud-server</span>,
  DatabaseOutlined: () => <span>database</span>,
  FireOutlined: () => <span>fire</span>,
  GlobalOutlined: () => <span>global</span>,
  MessageOutlined: () => <span>message</span>,
  PlusOutlined: () => <span>plus</span>,
  ReloadOutlined: () => <span>reload</span>,
  RobotOutlined: () => <span>robot</span>,
  ThunderboltOutlined: () => <span>thunder</span>,
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    icon,
    onClick,
  }: {
    children?: React.ReactNode;
    icon?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Card: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
  Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Descriptions: Object.assign(
    ({ children }: { children?: React.ReactNode }) => <dl>{children}</dl>,
    {
      Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
        <div>
          <dt>{label}</dt>
          <dd>{children}</dd>
        </div>
      ),
    },
  ),
  List: Object.assign(
    ({
      dataSource,
      renderItem,
    }: {
      dataSource?: unknown[];
      renderItem?: (item: unknown) => React.ReactNode;
    }) => <div>{dataSource?.map((item) => renderItem?.(item))}</div>,
    {
      Item: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    },
  ),
  Progress: ({ percent }: { percent?: number }) => <span>{percent}%</span>,
  Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Table: ({
    columns,
    dataSource,
  }: {
    columns?: Array<{ key?: string; title?: React.ReactNode; render?: (_: unknown, record: any) => React.ReactNode; dataIndex?: string }>;
    dataSource?: any[];
  }) => (
    <table>
      <tbody>
        {dataSource?.map((record) => (
          <tr key={record.key}>
            {columns?.map((column) => (
              <td key={String(column.key ?? column.dataIndex)}>
                {column.render ? column.render(undefined, record) : record[column.dataIndex ?? '']}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    title,
    subTitle,
    content,
    extra,
    children,
  }: {
    title: string;
    subTitle?: React.ReactNode;
    content?: React.ReactNode;
    extra?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      <div>{content}</div>
      <div>{extra}</div>
      {children}
    </main>
  ),
}));

import Home from '@renderer/entries/workbench/pages/Home';

describe('Workbench Home convergence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('positions the product as a task operations command center', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: '任务运营总览' })).toBeDefined();
    expect(screen.getByText('本地优先的 Web 任务运营平台')).toBeDefined();
    expect(screen.getByText(/Task -> Batch -> Result -> Alert -> Review -> Template/)).toBeDefined();
    expect(screen.queryByText('股票分析')).toBeNull();
    expect(screen.queryByText('在线插件')).toBeNull();
  });

  it('shows the core operations surfaces instead of module showcase cards', () => {
    render(<Home />);

    expect(screen.getByText('今日任务运行')).toBeDefined();
    expect(screen.getByText('需处理告警')).toBeDefined();
    expect(screen.getByText('Runner 健康')).toBeDefined();
    expect(screen.getByText('最近结果')).toBeDefined();
    expect(screen.getByText('AI 复盘建议')).toBeDefined();
    expect(screen.getByText('快速创建任务')).toBeDefined();
  });

  it('routes quick task creation to existing task template surfaces', () => {
    render(<Home />);

    fireEvent.click(screen.getByRole('button', { name: /创建热点采集任务/ }));
    expect(navigateMock).toHaveBeenCalledWith('/hot-monitor');

    fireEvent.click(screen.getByRole('button', { name: /创建评论采集任务/ }));
    expect(navigateMock).toHaveBeenCalledWith('/comment-monitor');

    fireEvent.click(screen.getByRole('button', { name: /创建签到巡检任务/ }));
    expect(navigateMock).toHaveBeenCalledWith('/signin');

    fireEvent.click(screen.getByRole('button', { name: /创建通用网页采集/ }));
    expect(navigateMock).toHaveBeenCalledWith('/automation');
  });

  it('links operational records to the right existing workspaces', () => {
    render(<Home />);

    fireEvent.click(screen.getByRole('button', { name: '查看任务中心' }));
    expect(navigateMock).toHaveBeenCalledWith('/automation');

    fireEvent.click(screen.getByRole('button', { name: '查看结果中心' }));
    expect(navigateMock).toHaveBeenCalledWith('/data-center');

    fireEvent.click(screen.getByRole('button', { name: '进入介入浏览器' }));
    expect(navigateMock).toHaveBeenCalledWith('/browser');
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- tests/unit/components/Home.test.tsx
```

Expected before implementation: FAIL because `Home.tsx` still renders `中台总览`, `股票分析`, `在线插件`, and module-showcase content.

---

### Task 4: Implement Task Operations Home Page

**Files:**
- Modify: `src/renderer/entries/workbench/pages/Home.tsx`
- Modify: `src/renderer/entries/workbench/styles.css`
- Test: `tests/unit/components/Home.test.tsx`

- [ ] **Step 1: Replace Home imports**

Replace the imports at the top of `Home.tsx` with:

```tsx
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
```

- [ ] **Step 2: Replace interfaces and static data**

Replace all interfaces and constants before `export default function Home()` with:

```tsx
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
    title: '今日任务运行',
    value: '18',
    meta: '13 成功 / 3 运行中 / 2 需介入',
    tone: 'blue',
    icon: <RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />,
  },
  {
    title: '需处理告警',
    value: '2',
    meta: '1 个登录失效，1 个 Runner 超时',
    tone: 'red',
    icon: <AlertOutlined style={{ fontSize: 20, color: '#ef4444' }} />,
  },
  {
    title: 'Runner 健康',
    value: '4 / 5',
    meta: '本地 1 个，远程 3 个在线',
    tone: 'green',
    icon: <CloudServerOutlined style={{ fontSize: 20, color: '#16a34a' }} />,
  },
  {
    title: '最近结果',
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
    action: '查看任务中心',
  },
  {
    title: '热点报告已生成',
    description: 'AI 行业热点采集已产出 HTML 报告和结构化结果，可进入结果中心导出。',
    tag: '结果',
    severity: 'stable',
    route: '/data-center',
    action: '查看结果中心',
  },
];

const runnerHealth: RunnerHealthItem[] = [
  { label: '本地 Runner 可用率', percent: 92, description: '1 个本地执行器在线' },
  { label: '远程 Runner 可用率', percent: 80, description: '3 / 4 个远程执行器在线' },
  { label: '队列消化率', percent: 68, description: '6 个待运行，3 个运行中' },
];

const runtimeProfile = {
  platform: '本地优先',
  spine: 'Task -> Batch -> Result -> Alert -> Review -> Template',
  firstPath: '热点采集任务',
  deferred: 'Stock / 插件市场 / 云多租户',
};
```

- [ ] **Step 3: Replace `Home` component body**

Replace `export default function Home() { ... }` with:

```tsx
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
                <List.Item className="yclaw-todo-item">
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
              <Button icon={<DatabaseOutlined />} onClick={() => navigate('/data-center')}>
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
```

- [ ] **Step 4: Add minimal CSS for the new home layout**

Append to `src/renderer/entries/workbench/styles.css`:

```css
.yclaw-ops-metric .ant-card-body {
  min-height: 132px;
}

.yclaw-ops-metric-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: rgba(22, 119, 255, 0.08);
  flex: none;
}

.yclaw-ops-metric h3.ant-typography {
  margin: 2px 0;
  font-size: 26px;
}

.yclaw-ops-metric-blue {
  border-color: rgba(22, 119, 255, 0.22);
}

.yclaw-ops-metric-green {
  border-color: rgba(22, 163, 74, 0.22);
}

.yclaw-ops-metric-orange {
  border-color: rgba(245, 158, 11, 0.22);
}

.yclaw-ops-metric-red {
  border-color: rgba(239, 68, 68, 0.22);
}

.yclaw-resource-block {
  margin-bottom: 16px;
}
```

- [ ] **Step 5: Run the focused home test**

Run:

```bash
npm test -- tests/unit/components/Home.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run navigation and home tests together**

Run:

```bash
npm test -- tests/unit/components/AdminPageLayout.test.tsx tests/unit/components/Home.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit home convergence**

Run:

```bash
git add src/renderer/entries/workbench/pages/Home.tsx src/renderer/entries/workbench/styles.css tests/unit/components/Home.test.tsx
git commit -m "feat: refocus workbench home on task operations"
```

---

### Task 5: Update Stable Docs for Phase 0 Direction

**Files:**
- Modify: `docs/overview/current-status.md`
- Modify: `docs/overview/roadmap.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Update current-status positioning**

In `docs/overview/current-status.md`, add this row to the “当前状态总览” table after `启动治理`:

```markdown
| 产品收敛     | Phase 0 已启动        | Workbench 首页和导航开始从模块橱窗收敛为任务运营总览，Hot / Comment / Signin 作为任务类型承接 |
```

- [ ] **Step 2: Update roadmap with the convergence design reference**

In `docs/overview/roadmap.md`, add this paragraph after the “近期主路线：小团队任务运营闭环” heading:

```markdown
> 2026-05-17 起，近期主路线进一步收敛为“本地优先的 Web 任务运营平台”。Phase 0 先调整首页、导航和模块优先级，详见 `docs/superpowers/specs/2026-05-17-task-operations-convergence-design.md`。
```

- [ ] **Step 3: Add the process design to docs index**

In `docs/README.md`, under “Agent 过程产物（superpowers）”, add:

```markdown
- [superpowers/specs/2026-05-17-task-operations-convergence-design.md](superpowers/specs/2026-05-17-task-operations-convergence-design.md)：任务运营主线收敛设计
```

- [ ] **Step 4: Verify docs grep**

Run:

```bash
rg -n "任务运营主线收敛|本地优先的 Web 任务运营平台|Phase 0 已启动" docs
```

Expected: output includes the updated `docs/overview/current-status.md`, `docs/overview/roadmap.md`, and `docs/README.md`.

- [ ] **Step 5: Commit docs alignment**

Run:

```bash
git add docs/overview/current-status.md docs/overview/roadmap.md docs/README.md
git commit -m "docs: align status with task operations convergence"
```

---

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused component tests**

Run:

```bash
npm test -- tests/unit/components/AdminPageLayout.test.tsx tests/unit/components/Home.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: clean working tree on the implementation branch.

---

## Self-Review

| Check | Result |
| --- | --- |
| Spec coverage | Covers Phase 0 from the convergence spec: homepage, navigation, copy, module priority, no backend changes |
| Deferred requirements | Runner stability, Data Center real-data linking, Browser intervention, and AI review are intentionally deferred to later phases |
| Placeholder scan | No placeholder steps; every task has exact files, code, commands, and expected outcomes |
| Type consistency | Test labels, route paths, and menu labels match the implementation snippets |
| Risk | `Home.tsx` remains large, but this is acceptable for Phase 0 because real-data extraction will happen in Phase 1 |
