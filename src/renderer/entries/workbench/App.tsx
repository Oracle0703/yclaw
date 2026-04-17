import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Skeleton } from 'antd';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import { ErrorBoundary } from '../../shared/components/ErrorBoundary';
import { CommandPalette } from '../../shared/components/CommandPalette';
import { AIChatPanel } from '../../shared/components/AIChatPanel';
import { FeatureModulePage } from '../../shared/components/FeatureModulePage';
import Home from './pages/Home';
import Settings from './pages/Settings';

const BrowserPage = lazy(() => import('../browser/App'));

const PageFallback = (
  <div style={{ padding: 24 }}>
    <Skeleton active paragraph={{ rows: 8 }} />
  </div>
);

export default function App() {
  return (
    <HashRouter>
      <AdminPageLayout>
        <ErrorBoundary>
          <Suspense fallback={PageFallback}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/stock"
                element={
                  <FeatureModulePage
                    moduleId="stock"
                    title="股票分析"
                    description="K 线、指标和行情分析已拆成可安装功能包，用更小的核心包承接首次安装。"
                  />
                }
              />
              <Route
                path="/automation"
                element={
                  <FeatureModulePage
                    moduleId="automation"
                    title="自动化采集"
                    description="任务编排、执行监控和结果导出改为按需安装，减少核心包体积。"
                  />
                }
              />
              <Route path="/browser" element={<BrowserPage />} />
              <Route
                path="/plugin-center"
                element={
                  <FeatureModulePage
                    moduleId="plugin-center"
                    title="插件中心"
                    description="插件中心以功能包方式分发，核心包只保留插件宿主和权限基础设施。"
                  />
                }
              />
            </Routes>
          </Suspense>
          <CommandPalette />
          <AIChatPanel />
        </ErrorBoundary>
      </AdminPageLayout>
    </HashRouter>
  );
}
