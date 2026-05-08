import { useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  BarsOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FireOutlined,
  MessageOutlined,
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

interface ModuleMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const MODULE_MENU: ModuleMenuItem[] = [
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
    key: '/hot-monitor',
    label: '热点监控',
    icon: <FireOutlined />,
  },
  {
    key: '/comment-monitor',
    label: '评论监控',
    icon: <MessageOutlined />,
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
  const matchedKey = MODULE_MENU.map((item) => item.key)
    .filter((key) => key !== '/')
    .find((key) => pathname === key || pathname.startsWith(`${key}/`));

  return matchedKey ?? '/';
}

function getSelectedMenuLabel(selectedKey: string): string {
  return MODULE_MENU.find((menuItem) => menuItem.key === selectedKey)?.label ?? '总览';
}

function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day} ${formatLocalTime(date)}`;
}

export function AdminPageLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const selectedKey = useMemo(() => getSelectedMenuKey(location.pathname), [location.pathname]);
  const selectedTitle = useMemo(() => getSelectedMenuLabel(selectedKey), [selectedKey]);
  const visibleLocalTime = collapsed ? formatLocalTime(now) : formatLocalDateTime(now);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
          theme="light"
          width={204}
          collapsible
          trigger={null}
          collapsed={collapsed}
          collapsedWidth={64}
          onCollapse={setCollapsed}
        >
          <div className="yclaw-admin-sider">
            <Menu
              mode="inline"
              theme="light"
              className="yclaw-admin-menu"
              selectedKeys={[selectedKey]}
              items={MODULE_MENU as MenuProps['items']}
              onClick={({ key }) => {
                handleMenuJump(String(key));
              }}
            />

            <div className="yclaw-admin-sider-footer">
              <Button
                type="text"
                className="yclaw-admin-trigger yclaw-admin-sider-trigger"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => {
                  setCollapsed((value) => !value);
                }}
                aria-label={collapsed ? '展开导航' : '收起导航'}
              />
              <div className="yclaw-local-time" aria-label={visibleLocalTime}>
                <span className="yclaw-local-time-value">{visibleLocalTime}</span>
              </div>
            </div>
          </div>
        </Layout.Sider>

        <Layout className="yclaw-admin-main">
          <Layout.Header className="yclaw-admin-header">
            <Space size={12} className="yclaw-admin-header-left">
              <div className="yclaw-brand-title">
                <Typography.Text strong>{selectedTitle}</Typography.Text>
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
