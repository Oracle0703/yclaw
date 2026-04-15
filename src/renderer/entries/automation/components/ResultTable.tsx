import { useEffect, useState } from 'react';
import { Button, Space, Table, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { ExtractionResult } from '@shared/types';
import { useIpc } from '../../../shared/hooks';

interface ResultTableProps {
  taskId: string | null;
  batchId?: string | null;
}

export function ResultTable({ taskId, batchId }: ResultTableProps) {
  const { automation } = useIpc();
  const [results, setResults] = useState<ExtractionResult[]>([]);

  useEffect(() => {
    if (!taskId) {
      setResults([]);
      return;
    }

    void automation.listResults(taskId, batchId ?? undefined).then((data) => {
      setResults((data as ExtractionResult[]) ?? []);
    });
  }, [automation, taskId, batchId]);

  return (
    <ProCard
      className="yclaw-panel-card"
      title="采集结果"
      extra={
        <Space>
          <Button
            size="small"
            disabled={!taskId}
            onClick={() =>
              taskId && void automation.exportResults(taskId, batchId ?? undefined, 'csv')
            }
          >
            导出 CSV
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        pagination={false}
        dataSource={results}
        locale={{ emptyText: taskId ? '暂无结果' : '请先选择任务' }}
        columns={[
          {
            title: '结果 ID',
            dataIndex: 'id',
          },
          {
            title: '状态',
            dataIndex: 'status',
          },
          {
            title: '数据',
            key: 'data',
            render: (_, record: ExtractionResult) => (
              <Typography.Paragraph
                ellipsis={{ rows: 2, expandable: true }}
                style={{ marginBottom: 0 }}
              >
                {JSON.stringify(record.data)}
              </Typography.Paragraph>
            ),
          },
        ]}
      />
    </ProCard>
  );
}
