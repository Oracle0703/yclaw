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
  FundOutlined: () => <span>fund</span>,
  GlobalOutlined: () => <span>global</span>,
  HomeOutlined: () => <span>home</span>,
  MenuFoldOutlined: () => <span>fold</span>,
  MenuUnfoldOutlined: () => <span>unfold</span>,
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
      onClick,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button type="button" onClick={onClick}>
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
    vi.clearAllMocks();
    locationState.pathname = '/';
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
});
