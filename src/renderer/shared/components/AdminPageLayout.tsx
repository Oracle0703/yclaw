import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  AppstoreOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FundOutlined,
  GlobalOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Badge, Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

const MODULE_MENU: NonNullable<MenuProps['items']> = [
  {
    key: '/',
    label: '总览',
    icon: <HomeOutlined />,
  },
  {
    key: '/stock',
    label: '行情分析',
    icon: <FundOutlined />,
  },
  {
    key: '/automation',
    label: '自动化',
    icon: <RobotOutlined />,
  },
  {
    key: '/signin',
    label: '自动签到',
    icon: <CheckCircleOutlined />,
  },
  {
    key: '/data-center',
    label: '数据中心',
    icon: <DatabaseOutlined />,
  },
  {
    key: '/browser',
    label: '浏览器',
    icon: <GlobalOutlined />,
  },
  {
    key: '/plugin-center',
    label: '插件',
    icon: <DeploymentUnitOutlined />,
  },
  {
    key: '/settings',
    label: '设置',
    icon: <SettingOutlined />,
  },
];

function getSelectedMenuKey(pathname: string) {
  const matchedKey = MODULE_MENU.map((item) => String(item?.key ?? ''))
    .filter((key) => key !== '/')
    .find((key) => pathname === key || pathname.startsWith(`${key}/`));

  return matchedKey ?? '/';
}

export function AdminPageLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const selectedKey = useMemo(() => getSelectedMenuKey(location.pathname), [location.pathname]);

  const handleMenuJump = (path?: string) => {
    if (!path) {
      return;
    }
    navigate(path);
  };

  return (
    <div className="yclaw-admin-shell">
      <Layout className="yclaw-admin-layout">
        <Layout.Sider
          theme="dark"
          width={232}
          collapsible
          trigger={null}
          collapsed={collapsed}
          collapsedWidth={80}
          onCollapse={setCollapsed}
        >
          <div className="yclaw-admin-sider">
            <button
              type="button"
              className="yclaw-admin-brand"
              onClick={() => {
                handleMenuJump('/');
              }}
            >
              <div className="yclaw-brand-logo">Y</div>
              {!collapsed ? (
                <div>
                  <Typography.Text strong>YClaw Ops</Typography.Text>
                  <Typography.Text type="secondary" className="yclaw-brand-subtitle">
                    桌面运营台
                  </Typography.Text>
                </div>
              ) : null}
            </button>

            <Menu
              mode="inline"
              theme="dark"
              className="yclaw-admin-menu"
              selectedKeys={[selectedKey]}
              items={MODULE_MENU}
              onClick={({ key }) => {
                handleMenuJump(String(key));
              }}
            />

            {collapsed ? (
              <div className="yclaw-menu-footer-collapsed" aria-label="Ops Cockpit" title="Ops Cockpit">
                <AppstoreOutlined />
              </div>
            ) : (
              <div className="yclaw-menu-footer">
                <div className="yclaw-menu-footer-eyebrow">Ops Cockpit</div>
                <div className="yclaw-menu-footer-title">统一调度台</div>
                <div className="yclaw-menu-footer-text">流程、数据、插件统一编排</div>
                <div className="yclaw-menu-footer-meta">
                  <span>6 Modules</span>
                  <span>12 Runbooks</span>
                </div>
              </div>
            )}
          </div>
        </Layout.Sider>

        <Layout className="yclaw-admin-main">
          <Layout.Header className="yclaw-admin-header">
            <Space size={12} className="yclaw-admin-header-left">
              <Button
                type="text"
                className="yclaw-admin-trigger"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => {
                  setCollapsed((value) => !value);
                }}
                aria-label={collapsed ? '展开导航' : '收起导航'}
              />
              <div>
                <Typography.Text strong>YClaw Ops</Typography.Text>
                <Typography.Text type="secondary" className="yclaw-brand-subtitle">
                  桌面运营台
                </Typography.Text>
              </div>
            </Space>

            <Space size={12} wrap>
              <Tag color="cyan">
                <SafetyCertificateOutlined /> 安全
              </Tag>
              <Tag color="geekblue">
                <BarsOutlined /> 协同
              </Tag>
              <Badge dot>
                <NotificationOutlined className="yclaw-header-action" />
              </Badge>
            </Space>
          </Layout.Header>

          <Layout.Content className="yclaw-admin-content">{children}</Layout.Content>
        </Layout>
      </Layout>
    </div>
  );
}
