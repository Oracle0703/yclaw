import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Skeleton } from 'antd';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import { ErrorBoundary } from '../../shared/components/ErrorBoundary';
import { CommandPalette } from '../../shared/components/CommandPalette';
import { AIChatPanel } from '../../shared/components/AIChatPanel';
import Home from './pages/Home';
import Settings from './pages/Settings';

const StockPage = lazy(() => import('../stock/App'));
const AutomationPage = lazy(() => import('../automation/App'));
const BrowserPage = lazy(() => import('../browser/App'));
const PluginCenterPage = lazy(() => import('../plugin-center/App'));

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
              <Route path="/stock" element={<StockPage />} />
              <Route path="/automation" element={<AutomationPage />} />
              <Route path="/browser" element={<BrowserPage />} />
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
