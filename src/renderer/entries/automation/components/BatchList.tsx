import { useEffect, useMemo, useState } from 'react';
import { Button, List, Space, Tag, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { TaskBatch } from '@shared/types';
import { useIpc } from '../../../shared/hooks';

interface BatchListProps {
  taskId: string | null;
  onSelectBatch: (batchId: string) => void;
}

export function BatchList({ taskId, onSelectBatch }: BatchListProps) {
  const { automation } = useIpc();
  const [batches, setBatches] = useState<TaskBatch[]>([]);
  const [filter, setFilter] = useState<'all' | 'failed'>('all');

  useEffect(() => {
    if (!taskId) {
      setBatches([]);
      return;
    }

    void automation.listBatches(taskId).then((data) => {
      setBatches((data as TaskBatch[]) ?? []);
    });
  }, [automation, taskId]);

  const visibleBatches = useMemo(() => {
    if (filter === 'failed') {
      return batches.filter((item) => item.status === 'failed');
    }
    return batches;
  }, [batches, filter]);

  return (
    <ProCard
      className="yclaw-panel-card"
      title="执行批次"
      extra={(
        <Space>
          <Button size="small" onClick={() => setFilter('all')}>全部</Button>
          <Button size="small" onClick={() => setFilter('failed')}>仅失败</Button>
        </Space>
      )}
    >
      <List
        dataSource={visibleBatches}
        locale={{ emptyText: taskId ? '暂无批次' : '请先选择任务' }}
        renderItem={(batch) => (
          <List.Item onClick={() => onSelectBatch(batch.id)} style={{ cursor: 'pointer' }}>
            <Space direction="vertical" size={2}>
              <Typography.Text strong>{batch.id}</Typography.Text>
              <Tag color={batch.status === 'failed' ? 'error' : batch.status === 'running' ? 'processing' : 'default'}>
                {batch.status}
              </Tag>
            </Space>
          </List.Item>
        )}
      />
    </ProCard>
  );
}
