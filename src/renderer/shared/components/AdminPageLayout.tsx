import type { PropsWithChildren, ReactNode } from 'react';
import {
  AppstoreOutlined,
  BarsOutlined,
  DeploymentUnitOutlined,
  FundOutlined,
  GlobalOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Badge, Space, Tag, Typography } from 'antd';
import { PageContainer, ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { useIpc } from '../hooks';
import { IPC_CHANNELS } from '@shared/constants/channels';

const MODULE_MENU: MenuDataItem[] = [
  {
    path: '/workbench',
    name: '工作台',
    icon: <AppstoreOutlined />,
    children: [
      { path: '/workbench/home', name: '总览' },
      { path: '/workbench/settings', name: '设置中心', icon: <SettingOutlined /> },
    ],
  },
  {
    path: '/stock',
    name: '股票分析',
    icon: <FundOutlined />,
  },
  {
    path: '/automation',
    name: '自动化采集',
    icon: <RobotOutlined />,
  },
  {
    path: '/browser',
    name: '内嵌浏览器',
    icon: <GlobalOutlined />,
  },
  {
    path: '/plugin-center',
    name: '插件中心',
    icon: <DeploymentUnitOutlined />,
  },
];

const WINDOW_MODULE_MAP: Record<string, string> = {
  '/workbench': 'workbench',
  '/workbench/home': 'workbench',
  '/workbench/settings': 'workbench',
  '/stock': 'stock',
  '/automation': 'automation',
  '/browser': 'browser',
  '/plugin-center': 'plugin-center',
};

interface AdminPageLayoutProps extends PropsWithChildren {
  currentPath: string;
  title: string;
  subTitle?: string;
  extra?: ReactNode;
  content?: ReactNode;
  onNavigate?: (path: string) => void;
}

export function AdminPageLayout({
  currentPath,
  title,
  subTitle,
  extra,
  content,
  onNavigate,
  children,
}: AdminPageLayoutProps) {
  const { invoke } = useIpc();

  const handleMenuJump = async (path?: string) => {
    if (!path) {
      return;
    }

    if (path.startsWith('/workbench') && onNavigate) {
      onNavigate(path);
      return;
    }

    const moduleName = WINDOW_MODULE_MAP[path];
    if (!moduleName) {
      return;
    }

    await invoke(IPC_CHANNELS.WINDOW_OPEN, { module: moduleName });
  };

  return (
    <div className="yclaw-admin-shell">
      <ProLayout
        title="YClaw Console"
        logo={<div className="yclaw-brand-logo">Y</div>}
        layout="side"
        navTheme="realDark"
        fixSiderbar
        fixedHeader
        siderWidth={248}
        contentWidth="Fluid"
        location={{ pathname: currentPath }}
        route={{ routes: MODULE_MENU }}
        bgLayoutImgList={[]}
        menu={{
          locale: false,
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
        avatarProps={{
          title: '运营中台',
          size: 'small',
        }}
        actionsRender={() => [
          <Tag key="security" color="cyan">
            <SafetyCertificateOutlined /> 安全策略
          </Tag>,
          <Tag key="pipeline" color="geekblue">
            <BarsOutlined /> 多模块协同
          </Tag>,
          <Badge key="notice" dot>
            <NotificationOutlined className="yclaw-header-action" />
          </Badge>,
          <Tag key="runtime" color="blue">
            Electron
          </Tag>,
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
                void handleMenuJump(item.path);
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
                桌面智能中台
              </Typography.Text>
            </div>
          </Space>
        )}
        menuFooterRender={() => (
          <div className="yclaw-menu-footer">
            <div className="yclaw-menu-footer-title">Ops Cockpit</div>
            <div className="yclaw-menu-footer-text">统一调度工作流、数据与插件能力</div>
            <div className="yclaw-menu-footer-meta">
              <span>Runbooks 12</span>
              <span>Plugins 15</span>
            </div>
          </div>
        )}
      >
        <PageContainer
          title={title}
          subTitle={subTitle}
          extra={extra}
          content={content}
          className="yclaw-page-container"
        >
          {children}
        </PageContainer>
      </ProLayout>
    </div>
  );
}
