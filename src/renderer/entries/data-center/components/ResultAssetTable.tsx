import { useEffect, useState } from 'react';
import { Button, Space, Table, Typography, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { DataCenterResultDetail, DataPage, ExtractionResult } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';
import { ResultDetailDrawer } from './ResultDetailDrawer';

export function ResultAssetTable() {
  const { dataCenter } = useIpc();
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [detail, setDetail] = useState<DataCenterResultDetail | null>(null);

  useEffect(() => {
    void dataCenter.listResults({ page: 1, pageSize: 20 }).then((value) => {
      setResults(((value as DataPage<ExtractionResult>)?.items ?? []) as ExtractionResult[]);
    });
  }, [dataCenter]);

  const openDetail = async (resultId: string) => {
    const next = (await dataCenter.getResultDetail(resultId)) as DataCenterResultDetail;
    setDetail(next);
  };

  const exportJsonl = async () => {
    try {
      await dataCenter.createExport({
        name: `结果资产-${new Date().toISOString()}`,
        query: { page: 1, pageSize: 500 },
        targetType: 'file',
        targetConfig: {},
        format: 'jsonl',
      });
      message.success('已创建 JSONL 导出任务');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建导出任务失败');
    }
  };

  return (
    <ProCard
      title="结果资产"
      className="yclaw-panel-card"
      extra={
        <Space>
          <Button onClick={() => void exportJsonl()}>导出 JSONL</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        pagination={false}
        dataSource={results}
        columns={[
          { title: '结果 ID', dataIndex: 'id' },
          { title: '状态', dataIndex: 'status' },
          {
            title: '数据',
            render: (_, record: ExtractionResult) => (
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {JSON.stringify(record.data)}
              </Typography.Paragraph>
            ),
          },
          {
            title: '操作',
            render: (_, record: ExtractionResult) => (
              <Button type="link" onClick={() => void openDetail(record.id)}>
                查看详情
              </Button>
            ),
          },
        ]}
      />
      <ResultDetailDrawer open={Boolean(detail)} detail={detail} onClose={() => setDetail(null)} />
    </ProCard>
  );
}
