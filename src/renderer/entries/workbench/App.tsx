import { startTransition, useEffect, useState } from 'react';
import { Button, Space, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import Home from './pages/Home';
import Settings from './pages/Settings';

const PAGE_META = {
  '/': {
    currentPath: '/workbench/home',
    title: '中台总览',
    subTitle: '统一查看数据、流程、插件和浏览器能力的整体运行态势',
    content:
      '以驾驶舱方式汇总执行效率、风险事件与模块资源，用一个工作台完成监控、分析和调度。',
  },
  '/settings': {
    currentPath: '/workbench/settings',
    title: '设置中心',
    subTitle: '维护工作台的基础配置、启动策略和模块偏好',
    content:
      '配置将通过 IPC 持久化到主进程侧，用于同步桌面工作台的启动模式、语言和运行偏好。',
  },
} as const;

const SETTINGS_PRELOAD_DELAY_MS = 320;

function WorkbenchShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const meta = PAGE_META[location.pathname as keyof typeof PAGE_META] ?? PAGE_META['/'];
  const currentPage = location.pathname === '/settings' ? 'settings' : 'home';
  const [visitedPages, setVisitedPages] = useState({
    home: true,
    settings: currentPage === 'settings',
  });

  useEffect(() => {
    setVisitedPages((prev) => ({
      ...prev,
      [currentPage]: true,
    }));
  }, [currentPage]);

  useEffect(() => {
    if (visitedPages.settings) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisitedPages((prev) => ({
        ...prev,
        settings: true,
      }));
    }, SETTINGS_PRELOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [visitedPages.settings]);

  return (
    <AdminPageLayout
      currentPath={meta.currentPath}
      title={meta.title}
      subTitle={meta.subTitle}
      content={meta.content}
      onNavigate={(path) => {
        startTransition(() => {
          navigate(path === '/workbench/settings' ? '/settings' : '/');
        });
      }}
      extra={
        <Space>
          <Tag color="processing">Console</Tag>
          <Tag color="cyan">Admin UI</Tag>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新界面
          </Button>
          <Button type="primary" icon={<PlusOutlined />}>
            发起新流程
          </Button>
        </Space>
      }
    >
      {visitedPages.home ? (
        <div style={{ display: currentPage === 'home' ? 'block' : 'none' }} aria-hidden={currentPage !== 'home'}>
          <Home />
        </div>
      ) : null}
      {visitedPages.settings ? (
        <div
          style={{ display: currentPage === 'settings' ? 'block' : 'none' }}
          aria-hidden={currentPage !== 'settings'}
        >
          <Settings active={currentPage === 'settings'} preload />
        </div>
      ) : null}
    </AdminPageLayout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <WorkbenchShell />
    </HashRouter>
  );
}
