import { useEffect, useState } from 'react';
import { Button, Space, Table, Typography, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { ExtractionResult } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';
import { useIpc } from '../../../shared/hooks';

interface ResultTableProps {
  taskId: string | null;
  batchId?: string | null;
}

export function ResultTable({ taskId, batchId }: ResultTableProps) {
  const { automation, invoke } = useIpc();
  const [results, setResults] = useState<ExtractionResult[]>([]);

  useEffect(() => {
    let isCurrent = true;

    if (!taskId) {
      setResults([]);
      return () => {
        isCurrent = false;
      };
    }

    void automation.listResults(taskId, batchId ?? undefined)
      .then((data) => {
        if (isCurrent) {
          setResults((data as ExtractionResult[]) ?? []);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setResults([]);
          message.error(error instanceof Error ? error.message : '加载结果失败');
        }
      });

    return () => {
      isCurrent = false;
    };
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
            onClick={() => {
              void invoke(IPC_CHANNELS.WINDOW_OPEN, {
                module: 'data-center',
                options: { width: 1180, height: 760 },
              }).catch((error) => {
                message.error(error instanceof Error ? error.message : '打开数据中心失败');
              });
            }}
          >
            打开数据中心
          </Button>
          <Button
            size="small"
            disabled={!taskId}
            onClick={() => {
              if (!taskId) {
                return;
              }

              void automation.exportResults(taskId, batchId ?? undefined, 'csv').catch((error) => {
                message.error(error instanceof Error ? error.message : '导出结果失败');
              });
            }}
          >
            快速导出 CSV
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
