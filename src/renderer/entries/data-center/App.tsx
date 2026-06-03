import { Alert, Tabs } from 'antd';
import { PageShell } from '@renderer/shared/components/PageShell';
import { DataOverview } from './components/DataOverview';
import { ResultAssetTable } from './components/ResultAssetTable';
import { ExportJobTable } from './components/ExportJobTable';
import { DatasetPanel } from './components/DatasetPanel';
import { ApiAccessPanel } from './components/ApiAccessPanel';
import { WebhookTargetPanel } from './components/WebhookTargetPanel';
import { QualityRulePanel } from './components/QualityRulePanel';
import type { DataCenterRouteContext } from './routeContext';

interface AppProps {
  routeContext?: DataCenterRouteContext | null;
}

export default function App({ routeContext = null }: AppProps) {
  return (
    <PageShell
      title="数据中心"
      subTitle="统一收口结果资产、导出任务、数据集与开放接口。"
    >
      {routeContext ? (
        <Alert
          message={routeContext.source === 'hot-monitor' ? '来自热点监控' : '已限定数据上下文'}
          description={[
            routeContext.taskId ? `Task：${routeContext.taskId}` : null,
            routeContext.batchId ? `Batch：${routeContext.batchId}` : null,
            buildContextScopeDescription(routeContext),
          ].filter(Boolean).join(' · ')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <Tabs
        items={[
          { key: 'overview', label: '数据总览', children: <DataOverview /> },
          { key: 'results', label: '结果资产', children: <ResultAssetTable context={routeContext} /> },
          { key: 'exports', label: '导出任务', children: <ExportJobTable context={routeContext} /> },
          { key: 'datasets', label: '数据集', children: <DatasetPanel /> },
          { key: 'webhooks', label: 'Webhook', children: <WebhookTargetPanel /> },
          { key: 'api', label: '开放接口', children: <ApiAccessPanel /> },
          { key: 'quality', label: '数据质量', children: <QualityRulePanel context={routeContext} /> },
        ]}
      />
    </PageShell>
  );
}

function buildContextScopeDescription(context: DataCenterRouteContext): string {
  if (context.batchId) {
    return '结果、新建导出和质量扫描将默认限定在该批次。';
  }
  if (context.taskId) {
    return '结果、新建导出和质量扫描将默认限定在该任务。';
  }
  return '结果、新建导出和质量扫描将默认限定在当前上下文。';
}
