import { Tabs } from 'antd';
import { PageShell } from '@renderer/shared/components/PageShell';
import { DataOverview } from './components/DataOverview';
import { ResultAssetTable } from './components/ResultAssetTable';
import { ExportJobTable } from './components/ExportJobTable';
import { DatasetPanel } from './components/DatasetPanel';
import { ApiAccessPanel } from './components/ApiAccessPanel';
import { WebhookTargetPanel } from './components/WebhookTargetPanel';
import { QualityRulePanel } from './components/QualityRulePanel';

export default function App() {
  return (
    <PageShell
      title="数据中心"
      subTitle="统一收口结果资产、导出任务、数据集与开放接口。"
    >
      <Tabs
        items={[
          { key: 'overview', label: '数据总览', children: <DataOverview /> },
          { key: 'results', label: '结果资产', children: <ResultAssetTable /> },
          { key: 'exports', label: '导出任务', children: <ExportJobTable /> },
          { key: 'datasets', label: '数据集', children: <DatasetPanel /> },
          { key: 'webhooks', label: 'Webhook', children: <WebhookTargetPanel /> },
          { key: 'api', label: '开放接口', children: <ApiAccessPanel /> },
          { key: 'quality', label: '数据质量', children: <QualityRulePanel /> },
        ]}
      />
    </PageShell>
  );
}
