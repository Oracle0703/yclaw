import { useEffect, useState } from 'react';
import { Button, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type {
  DataQualityScanInput,
  DataQualityResultScore,
  DataQualityIssue,
  DataQualityRuleConfig,
  DataQualityRuleSummary,
  DataQualityScanResult,
} from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';
import type { DataCenterRouteContext } from '../routeContext';

export function QualityRulePanel({
  context = null,
}: {
  context?: DataCenterRouteContext | null;
}) {
  const { dataCenter } = useIpc();
  const [rules, setRules] = useState<DataQualityRuleConfig[]>([]);
  const [scan, setScan] = useState<DataQualityScanResult>({
    scannedAt: '',
    totalResults: 0,
    issueCount: 0,
    affectedResults: 0,
    rules: [],
    issues: [],
  });
  useEffect(() => {
    void dataCenter.listQualityRules().then((value) => {
      setRules((value as DataQualityRuleConfig[]) ?? []);
    });
  }, [dataCenter]);

  const setRuleEnabled = async (rule: DataQualityRuleConfig, enabled: boolean) => {
    try {
      const saved = (await dataCenter.saveQualityRule({
        ruleId: rule.ruleId,
        enabled,
      })) as Partial<DataQualityRuleConfig> & { ruleId: string };
      setRules((current) =>
        current.map((item) =>
          item.ruleId === saved.ruleId ? { ...item, ...saved, enabled } : item,
        ),
      );
      message.success(enabled ? '规则已启用' : '规则已停用');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新质量规则失败');
    }
  };

  const scanQuality = async () => {
    try {
      const next = (await dataCenter.scanQuality(buildQualityScanInput(context))) as DataQualityScanResult;
      setScan(next);
      message.success('数据质量扫描完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '数据质量扫描失败');
    }
  };

  return (
    <>
      <ProCard
        title="数据质量"
        className="yclaw-panel-card"
        extra={
          <Button type="primary" onClick={() => void scanQuality()}>
            {context?.batchId ? '扫描当前批次' : '立即扫描'}
          </Button>
        }
      >
        <Space size="large">
          <Statistic title="扫描结果" value={scan.totalResults} />
          <Statistic title="质量问题" value={scan.issueCount} />
          <Statistic title="影响结果" value={scan.affectedResults} />
        </Space>
      </ProCard>
      <ProCard title="质量评分" className="yclaw-panel-card">
        <Space size="large">
          <Statistic title="批次质量分" value={scan.batchScore?.score ?? '-'} />
          <Statistic title="评分等级" value={scan.batchScore?.grade ?? '-'} />
        </Space>
        <Table
          rowKey="resultId"
          pagination={false}
          dataSource={scan.scores?.slice(0, 10) ?? []}
          columns={[
            { title: '结果 ID', dataIndex: 'resultId' },
            { title: '得分', dataIndex: 'score' },
            { title: '等级', dataIndex: 'grade' },
            {
              title: '扣分项',
              render: (_, record: DataQualityResultScore) =>
                record.deductions.map((deduction) => `${deduction.ruleId}(-${deduction.points})`).join(', ') ||
                '-',
            },
          ]}
        />
      </ProCard>
      <ProCard title="批次洞察" className="yclaw-panel-card">
        <Space size="large">
          <Statistic title="失败率" value={formatRate(scan.batchInsight?.failedRate)} />
          <Statistic title="可疑率" value={formatRate(scan.batchInsight?.suspiciousRate)} />
          <Statistic title="趋势" value={scan.batchInsight?.scoreTrendHint ?? '-'} />
        </Space>
        <Typography.Paragraph>{scan.batchInsight?.summary ?? '暂无批次洞察，请先执行扫描。'}</Typography.Paragraph>
        <Table
          rowKey="ruleId"
          pagination={false}
          dataSource={scan.batchInsight?.topRules ?? []}
          columns={[
            { title: 'Top 规则', dataIndex: 'ruleId' },
            { title: '命中次数', dataIndex: 'count' },
          ]}
        />
        <Table
          rowKey="fieldPath"
          pagination={false}
          dataSource={scan.batchInsight?.topFields ?? []}
          columns={[
            { title: 'Top 字段', dataIndex: 'fieldPath' },
            { title: '命中次数', dataIndex: 'count' },
          ]}
        />
      </ProCard>
      <ProCard title="规则配置" className="yclaw-panel-card">
        <Table
          rowKey="ruleId"
          pagination={false}
          dataSource={rules}
          columns={[
            { title: '规则', dataIndex: 'name' },
            { title: '说明', dataIndex: 'description' },
            {
              title: '状态',
              render: (_, record: DataQualityRuleConfig) => <Tag>{record.enabled ? '启用' : '停用'}</Tag>,
            },
            {
              title: '操作',
              render: (_, record: DataQualityRuleConfig) => (
                <Button type="link" onClick={() => void setRuleEnabled(record, !record.enabled)}>
                  {record.enabled ? '停用规则' : '启用规则'}
                </Button>
              ),
            },
          ]}
        />
      </ProCard>
      <ProCard title="规则命中" className="yclaw-panel-card">
        <Table
          rowKey="ruleId"
          pagination={false}
          dataSource={scan.rules}
          columns={[
            { title: '规则', dataIndex: 'name' },
            {
              title: '级别',
              render: (_, record: DataQualityRuleSummary) => (
                <Tag>{record.severity === 'error' ? '错误' : '警告'}</Tag>
              ),
            },
            { title: '命中数', dataIndex: 'hitCount' },
            {
              title: '样例结果',
              render: (_, record: DataQualityRuleSummary) => record.sampleResultIds.join(', ') || '-',
            },
          ]}
        />
      </ProCard>
      <ProCard title="问题样例" className="yclaw-panel-card">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={scan.issues.slice(0, 20)}
          columns={[
            { title: '结果 ID', dataIndex: 'resultId' },
            { title: '任务 ID', dataIndex: 'taskId' },
            { title: '批次 ID', dataIndex: 'batchId' },
            { title: '说明', dataIndex: 'message' },
            {
              title: '级别',
              render: (_, record: DataQualityIssue) => (
                <Tag>{record.severity === 'error' ? '错误' : '警告'}</Tag>
              ),
            },
          ]}
        />
      </ProCard>
    </>
  );
}

function formatRate(value?: number): string {
  if (typeof value !== 'number') {
    return '-';
  }
  return `${Math.round(value * 100)}%`;
}

function buildQualityScanInput(context: DataCenterRouteContext | null | undefined): DataQualityScanInput {
  return {
    ...(context?.taskId || context?.batchId
      ? {
          query: {
            ...(context?.taskId ? { taskId: context.taskId } : {}),
            ...(context?.batchId ? { batchId: context.batchId } : {}),
          },
        }
      : {}),
    limit: 200,
  };
}
