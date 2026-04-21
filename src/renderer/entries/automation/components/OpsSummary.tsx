import { Card, Col, Row, Statistic } from 'antd';
import type { OperationsAcceptanceMetric } from '@shared/types';

export interface OpsSummaryMetrics {
  queued: number;
  running: number;
  failed: number;
  waitingIntervention: number;
}

export interface OpsSummaryCopilot {
  enabled: boolean;
  highlights?: string[];
}

export function OpsSummary({
  summary,
  copilot,
  acceptanceMetrics,
}: {
  summary: OpsSummaryMetrics;
  copilot?: OpsSummaryCopilot;
  acceptanceMetrics?: OperationsAcceptanceMetric[];
}) {
  return (
    <Card title="执行总览">
      <Row gutter={12}>
        <Col span={6}>
          <Statistic title="待执行" value={summary.queued} />
        </Col>
        <Col span={6}>
          <Statistic title="执行中" value={summary.running} />
        </Col>
        <Col span={6}>
          <Statistic title="失败" value={summary.failed} />
        </Col>
        <Col span={6}>
          <Statistic title="待介入" value={summary.waitingIntervention} />
        </Col>
      </Row>
      {copilot?.enabled && copilot.highlights && copilot.highlights.length > 0 && (
        <div style={{ marginTop: 12 }}>
          AI 副驾驶：{copilot.highlights.join(' / ')}
        </div>
      )}
      {acceptanceMetrics && acceptanceMetrics.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {acceptanceMetrics.map((metric) => (
            <div key={metric.key}>
              {metric.label}
              {'：'}
              {formatMetric(metric)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatMetric(metric: OperationsAcceptanceMetric): string {
  if (metric.unit === 'ratio') {
    return `${(metric.value * 100).toFixed(1)}% / 目标 ${(metric.target * 100).toFixed(1)}%`;
  }

  return `${metric.value} / 目标 ${metric.target}`;
}
