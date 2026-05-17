import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

type MockTableRecord = Record<string, React.ReactNode> & {
  key: string;
};

vi.mock('@ant-design/icons', () => ({
  AlertOutlined: () => <span>alert</span>,
  ApiOutlined: () => <span>api</span>,
  ArrowUpOutlined: () => <span>arrow-up</span>,
  CheckCircleOutlined: () => <span>check-circle</span>,
  ClockCircleOutlined: () => <span>clock</span>,
  CloudServerOutlined: () => <span>cloud-server</span>,
  DatabaseOutlined: () => <span>database</span>,
  DeploymentUnitOutlined: () => <span>deployment</span>,
  FireOutlined: () => <span>fire</span>,
  FundOutlined: () => <span>fund</span>,
  GlobalOutlined: () => <span>global</span>,
  SafetyCertificateOutlined: () => <span>safety</span>,
  MessageOutlined: () => <span>message</span>,
  PlusOutlined: () => <span>plus</span>,
  ReloadOutlined: () => <span>reload</span>,
  RobotOutlined: () => <span>robot</span>,
  RocketOutlined: () => <span>rocket</span>,
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
  Card: ({
    children,
    extra,
    title,
  }: {
    children?: React.ReactNode;
    extra?: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {extra}
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
    columns?: Array<{
      key?: string;
      title?: React.ReactNode;
      render?: (_: unknown, record: MockTableRecord) => React.ReactNode;
      dataIndex?: string;
    }>;
    dataSource?: MockTableRecord[];
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

    const quickTaskSection = screen.getByRole('heading', { name: '快速创建任务' }).closest('section');
    expect(quickTaskSection).toBeDefined();
    const quickTasks = within(quickTaskSection as HTMLElement);

    fireEvent.click(quickTasks.getByRole('button', { name: /创建热点采集任务/ }));
    expect(navigateMock).toHaveBeenCalledWith('/hot-monitor');

    fireEvent.click(quickTasks.getByRole('button', { name: /创建评论采集任务/ }));
    expect(navigateMock).toHaveBeenCalledWith('/comment-monitor');

    fireEvent.click(quickTasks.getByRole('button', { name: /创建签到巡检任务/ }));
    expect(navigateMock).toHaveBeenCalledWith('/signin');

    fireEvent.click(quickTasks.getByRole('button', { name: /创建通用网页采集/ }));
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
