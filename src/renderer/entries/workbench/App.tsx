import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Skeleton } from 'antd';
import { EVENTS } from '@shared/constants';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import { ErrorBoundary } from '../../shared/components/ErrorBoundary';
import { CommandPalette } from '../../shared/components/CommandPalette';
import { AIChatPanel } from '../../shared/components/AIChatPanel';
import { useIpcEvent } from '../../shared/hooks';
import { parseBrowserInterventionRouteContext } from '../browser/routeContext';
import { parseDataCenterRouteContext } from '../data-center/routeContext';
import './styles.css';
import Home from './pages/Home';
import Settings from './pages/Settings';

const StockPage = lazy(() => import('../stock/App'));
const AutomationPage = lazy(() => import('../automation/App'));
const DataCenterPage = lazy(() => import('../data-center/App'));
const HotMonitorPage = lazy(() => import('../hot-monitor/App'));
const CommentMonitorPage = lazy(() => import('../comment-monitor/App'));
const PluginCenterPage = lazy(() => import('../plugin-center/App'));
const BrowserPage = lazy(() => import('../browser/App'));
const SigninPage = lazy(() => import('../signin/App'));

const PageFallback = (
  <div style={{ padding: 24 }}>
    <Skeleton active paragraph={{ rows: 8 }} />
  </div>
);

/** 内置模块 → 路由映射，供主进程 APP_NAVIGATE 事件路由使用 */
const MODULE_ROUTE_MAP: Record<string, string> = {
  workbench: '/',
  stock: '/stock',
  automation: '/automation',
  'data-center': '/data-center',
  'hot-monitor': '/hot-monitor',
  'comment-monitor': '/comment-monitor',
  'plugin-center': '/plugin-center',
  browser: '/browser',
  signin: '/signin',
};

interface PendingNavigateBridge {
  consumePendingNavigate(): string | null;
}

function NavigationBridge() {
  const navigate = useNavigate();

  useIpcEvent(EVENTS.APP_NAVIGATE, (...args: unknown[]) => {
    const payload = args[0] as { module?: string; route?: string } | undefined;
    if (!payload) return;
    if (typeof payload.route === 'string' && payload.route.length > 0) {
      navigate(payload.route);
      return;
    }
    if (typeof payload.module === 'string') {
      const target = MODULE_ROUTE_MAP[payload.module];
      if (target) {
        navigate(target);
      }
    }
  });

  // 处理冷启动竞态：preload 的 ipcRenderer.on 已经在 React 挂载前就 buffer 了
  // 主进程的 APP_NAVIGATE。挂载后消费一次。
  useEffect(() => {
    const bridge = (window as unknown as { __yclawNavigateBridge?: PendingNavigateBridge })
      .__yclawNavigateBridge;
    const pending = bridge?.consumePendingNavigate?.() ?? null;
    if (pending && MODULE_ROUTE_MAP[pending]) {
      navigate(MODULE_ROUTE_MAP[pending]);
    }
  }, [navigate]);

  return null;
}

function DataCenterRoutePage() {
  const location = useLocation();
  const routeContext = parseDataCenterRouteContext(location.state);

  return <DataCenterPage routeContext={routeContext} />;
}

function BrowserRoutePage() {
  const location = useLocation();
  const interventionContext = parseBrowserInterventionRouteContext(location.state);

  return <BrowserPage interventionContext={interventionContext} />;
}

export default function App() {
  return (
    <HashRouter>
      <AdminPageLayout>
        <ErrorBoundary>
          <NavigationBridge />
          <Suspense fallback={PageFallback}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/automation" element={<AutomationPage />} />
              <Route path="/signin" element={<SigninPage />} />
              <Route path="/data-center" element={<DataCenterRoutePage />} />
              <Route path="/hot-monitor" element={<HotMonitorPage />} />
              <Route path="/comment-monitor" element={<CommentMonitorPage />} />
              <Route path="/browser" element={<BrowserRoutePage />} />
              <Route path="/plugin-center" element={<PluginCenterPage />} />
            </Routes>
          </Suspense>
          <CommandPalette />
          <AIChatPanel />
        </ErrorBoundary>
      </AdminPageLayout>
    </HashRouter>
  );
}
