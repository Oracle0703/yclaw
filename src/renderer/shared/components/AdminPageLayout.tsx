import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  AppstoreOutlined,
  BarsOutlined,
  DeploymentUnitOutlined,
  FundOutlined,
  GlobalOutlined,
  HomeOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Badge, Space, Tag, Typography } from 'antd';
import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';

const MODULE_MENU: MenuDataItem[] = [
  {
    path: '/',
    name: '总览',
    icon: <HomeOutlined />,
  },
  {
    path: '/stock',
    name: '行情分析',
    icon: <FundOutlined />,
  },
  {
    path: '/automation',
    name: '自动化',
    icon: <RobotOutlined />,
  },
  {
    path: '/browser',
    name: '浏览器',
    icon: <GlobalOutlined />,
  },
  {
    path: '/plugin-center',
    name: '插件',
    icon: <DeploymentUnitOutlined />,
  },
  {
    path: '/settings',
    name: '设置',
    icon: <SettingOutlined />,
  },
];

export function AdminPageLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuJump = (path?: string) => {
    if (!path) {
      return;
    }
    navigate(path);
  };

  return (
    <div className="yclaw-admin-shell">
      <ProLayout
        title="YClaw Ops"
        logo={<div className="yclaw-brand-logo">Y</div>}
        layout="side"
        navTheme="realDark"
        fixSiderbar
        fixedHeader
        collapsed={collapsed}
        onCollapse={setCollapsed}
        siderWidth={232}
        contentWidth="Fluid"
        location={{ pathname: location.pathname }}
        route={{ routes: MODULE_MENU }}
        bgLayoutImgList={[]}
        menu={{
          locale: false,
          collapsedShowTitle: false,
        }}
        token={{
          header: {
            colorBgHeader: 'rgba(255, 255, 255, 0.88)',
            colorHeaderTitle: '#0f172a',
            colorTextMenuSecondary: '#475569',
            colorBgMenuItemHover: 'rgba(22, 119, 255, 0.08)',
          },
          sider: {
            colorBgMenuItemSelected: 'linear-gradient(90deg, rgba(22, 119, 255, 0.28), rgba(54, 207, 201, 0.2))',
            colorMenuItemDivider: 'rgba(255, 255, 255, 0.08)',
            colorTextMenu: 'rgba(255, 255, 255, 0.72)',
            colorTextMenuSelected: '#ffffff',
            colorTextMenuActive: '#ffffff',
          },
          pageContainer: {
            paddingInlinePageContainerContent: 24,
            paddingBlockPageContainerContent: 0,
          },
        }}
        actionsRender={() => [
          <Tag key="security" color="cyan">
            <SafetyCertificateOutlined /> 安全
          </Tag>,
          <Tag key="pipeline" color="geekblue">
            <BarsOutlined /> 协同
          </Tag>,
          <Badge key="notice" dot>
            <NotificationOutlined className="yclaw-header-action" />
          </Badge>,
        ]}
        menuItemRender={(item, dom) => {
          if (!item.path) {
            return dom;
          }

          return (
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                handleMenuJump(item.path);
              }}
            >
              {dom}
            </a>
          );
        }}
        headerTitleRender={(logo, pageTitle) => (
          <Space size={12}>
            {logo}
            <div>
              <Typography.Text strong>{pageTitle}</Typography.Text>
              <Typography.Text type="secondary" className="yclaw-brand-subtitle">
                桌面运营台
              </Typography.Text>
            </div>
          </Space>
        )}
        menuFooterRender={(props) =>
          props?.collapsed ? (
            <div className="yclaw-menu-footer-collapsed" aria-label="Ops Cockpit" title="Ops Cockpit">
              <AppstoreOutlined />
            </div>
          ) : (
            <div className="yclaw-menu-footer">
              <div className="yclaw-menu-footer-eyebrow">Ops Cockpit</div>
              <div className="yclaw-menu-footer-title">统一调度台</div>
              <div className="yclaw-menu-footer-text">流程、数据、插件统一编排</div>
              <div className="yclaw-menu-footer-meta">
                <span>5 Modules</span>
                <span>12 Runbooks</span>
              </div>
            </div>
          )
        }
      >
        {children}
      </ProLayout>
    </div>
  );
}
