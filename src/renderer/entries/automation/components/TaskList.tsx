import { useCallback, useEffect, useState } from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EVENTS } from '@shared/constants';
import type { TaskStatus } from '@shared/types';
import { ProCard } from '@ant-design/pro-components';
import { useIpc, useIpcEvent } from '../../../shared/hooks';

interface TaskSummary {
  id: string;
  name: string;
  status: TaskStatus;
  stepsCount?: number;
  updatedAt: string;
  latestBatch?: {
    id: string;
    status: string;
  } | null;
}

export function TaskList({
  onSelect,
}: {
  onSelect: (task: TaskSummary | 'new') => void;
}) {
  const { automation } = useIpc();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const res = await automation.listTasks() as TaskSummary[];
    setTasks(res ?? []);
    setLoading(false);
  }, [automation]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useIpcEvent(EVENTS.TASK_STATUS_CHANGED, () => {
    void fetchTasks();
  });

  const columns: ColumnsType<TaskSummary> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.id}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: TaskStatus) => {
        const colorMap: Record<TaskStatus, string> = {
          idle: 'default',
          running: 'processing',
          paused: 'warning',
          completed: 'success',
          failed: 'error',
        };
        return <Tag color={colorMap[value]}>{value}</Tag>;
      },
    },
    {
      title: '步骤数',
      dataIndex: 'stepsCount',
      key: 'stepsCount',
      width: 110,
    },
    {
      title: '最近更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => onSelect(record)}>
            打开
          </Button>
          <Button type="link" onClick={() => void automation.startTask(record.id)}>
            启动
          </Button>
          {record.latestBatch?.status === 'failed' && (
            <Button type="link" onClick={() => void automation.retryBatch(record.latestBatch!.id)}>
              复跑
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ProCard
      className="yclaw-panel-card"
      title="任务资产库"
      extra={
        <Button type="primary" onClick={() => onSelect('new')}>
          添加步骤
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tasks}
        locale={{ emptyText: '暂无任务，点击右上角按钮创建' }}
        pagination={false}
        onRow={(record) => ({
          onClick: () => onSelect(record),
        })}
      />
    </ProCard>
  );
}
