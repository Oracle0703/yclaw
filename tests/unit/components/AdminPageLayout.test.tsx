import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const { navigateMock, locationState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  locationState: { pathname: '/' },
}));

vi.mock('@ant-design/icons', () => ({
  AppstoreOutlined: () => <span>appstore</span>,
  BarsOutlined: () => <span>bars</span>,
  CheckCircleOutlined: () => <span>check-circle</span>,
  DatabaseOutlined: () => <span>database</span>,
  DeploymentUnitOutlined: () => <span>deployment</span>,
  FireOutlined: () => <span>fire</span>,
  FundOutlined: () => <span>fund</span>,
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

vi.mock('antd', () => {
  const Layout = Object.assign(
    ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    {
      Sider: ({ children }: { children?: React.ReactNode }) => <aside>{children}</aside>,
      Header: ({ children }: { children?: React.ReactNode }) => <header>{children}</header>,
      Content: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
    },
  );

  return {
    Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Button: ({
      children,
      icon,
      onClick,
      ...props
    }: {
      children?: React.ReactNode;
      icon?: React.ReactNode;
      onClick?: () => void;
      [key: string]: unknown;
    }) => (
      <button type="button" onClick={onClick} {...props}>
        {icon}
        {children}
      </button>
    ),
    Layout,
    Menu: ({
      items,
      onClick,
    }: {
      items?: Array<{ key?: string; label?: React.ReactNode }>;
      onClick?: (payload: { key: string }) => void;
    }) => (
      <nav>
        {items?.map((item) => (
          <button
            key={String(item.key)}
            type="button"
            onClick={() => onClick?.({ key: String(item.key) })}
          >
            {item.label}
          </button>
        ))}
      </nav>
    ),
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationState,
}));

import { AdminPageLayout } from '@renderer/shared/components/AdminPageLayout';

describe('AdminPageLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    locationState.pathname = '/';
    vi.setSystemTime(new Date(2026, 4, 7, 9, 8, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the auto sign-in menu and navigates to the standalone page', () => {
    render(
      <AdminPageLayout>
        <div>content</div>
      </AdminPageLayout>,
    );

    fireEvent.click(screen.getByRole('button', { name: '自动签到' }));

    expect(navigateMock).toHaveBeenCalledWith('/signin');
  });

  it('renders the hot monitor menu and navigates to the standalone page', () => {
    render(
      <AdminPageLayout>
        <div>content</div>
      </AdminPageLayout>,
    );

    fireEvent.click(screen.getByRole('button', { name: '热点监控' }));

    expect(navigateMock).toHaveBeenCalledWith('/hot-monitor');
  });

  it('renders the comment monitor menu and navigates to the standalone page', () => {
    render(
      <AdminPageLayout>
        <div>content</div>
      </AdminPageLayout>,
    );

    fireEvent.click(screen.getByRole('button', { name: '评论监控' }));

    expect(navigateMock).toHaveBeenCalledWith('/comment-monitor');
  });

  it('keeps navigation chrome compact with title only', () => {
    locationState.pathname = '/hot-monitor';

    render(
      <AdminPageLayout>
        <div>content</div>
      </AdminPageLayout>,
    );

    expect(screen.getAllByText('热点监控').length).toBeGreaterThan(0);
    expect(screen.queryByText('YClaw Ops')).toBeNull();
    expect(screen.queryByText('桌面运营台')).toBeNull();
    expect(screen.queryByText('统一调度台')).toBeNull();
    expect(screen.queryByText('流程、数据、插件统一编排')).toBeNull();
  });

  it('moves navigation controls to the sidebar footer without a hot entry in the content header', () => {
    const { container } = render(
      <AdminPageLayout>
        <div>content</div>
      </AdminPageLayout>,
    );

    expect(container.querySelector('.yclaw-admin-sider-header')).toBeNull();
    expect(container.querySelector('.yclaw-admin-topbar')).toBeNull();
    expect(container.querySelector('.yclaw-admin-header')).toBeDefined();
    expect(screen.getByText('2026-05-07 09:08')).toBeDefined();
    expect(screen.queryByText('本地时间')).toBeNull();
    expect(screen.getByRole('button', { name: '收起导航' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '热点' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Y' })).toBeNull();
  });

  it('keeps the content header inside the right-side area only', () => {
    const { container } = render(
      <AdminPageLayout>
        <div>content</div>
      </AdminPageLayout>,
    );

    expect(container.querySelector('.yclaw-admin-topbar')).toBeNull();
    expect(container.querySelector('.yclaw-admin-main > .yclaw-admin-header')).toBeDefined();
    expect(container.querySelector('.yclaw-admin-sider-header')).toBeNull();
  });

  it('shows only hour and minute when the sidebar is collapsed', () => {
    render(
      <AdminPageLayout>
        <div>content</div>
      </AdminPageLayout>,
    );

    fireEvent.click(screen.getByRole('button', { name: '收起导航' }));

    expect(screen.getByText('09:08')).toBeDefined();
    expect(screen.queryByText('05-07')).toBeNull();
    expect(screen.queryByText('2026-05-07 09:08')).toBeNull();
  });
});
