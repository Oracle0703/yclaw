import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EVENTS } from '@shared/constants';
import type { TaskStatus } from '@shared/types';
import { ProCard } from '@ant-design/pro-components';
import { useIpc, useIpcEvent } from '../../../shared/hooks';

interface TaskSummary {
  id: string;
  name: string;
  status: TaskStatus;
  description?: string;
  entryUrl?: string;
  stepsCount?: number;
  updatedAt: string;
  latestBatch?: {
    id: string;
    status: string;
  } | null;
}

function getTaskOriginBadges(record: TaskSummary): string[] {
  const badges: string[] = [];

  if (record.name.includes('评论草案')) {
    badges.push('评论草案');
  } else if (record.name.includes('关注复核')) {
    badges.push('关注复核');
  }

  if (record.description?.includes('任务草案')) {
    badges.push('浏览器移交');
  }

  if (record.description?.includes('占位选择器')) {
    badges.push('需补选择器');
  }

  return badges;
}

function getHostnameLabel(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function TaskList({
  onSelect,
}: {
  onSelect: (task: TaskSummary | 'new') => void;
}) {
  const { automation } = useIpc();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const requestSeqRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    try {
      const res = await automation.listTasks() as TaskSummary[];
      if (requestSeqRef.current === requestSeq) {
        setTasks(res ?? []);
      }
    } catch (error) {
      if (requestSeqRef.current === requestSeq) {
        message.error(error instanceof Error ? error.message : '加载任务失败');
      }
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
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
          {getTaskOriginBadges(record).length > 0 ? (
            <Space>
              {getTaskOriginBadges(record).map((badge) => (
                <Tag key={`${record.id}-${badge}`} color={badge === '需补选择器' ? 'warning' : 'processing'}>
                  {badge}
                </Tag>
              ))}
            </Space>
          ) : null}
          {getHostnameLabel(record.entryUrl) ? (
            <Typography.Text type="secondary">{getHostnameLabel(record.entryUrl)}</Typography.Text>
          ) : null}
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
          <Button
            type="link"
            onClick={() => {
              void automation.startTask(record.id).catch((error) => {
                message.error(error instanceof Error ? error.message : '启动任务失败');
              });
            }}
          >
            启动
          </Button>
          {record.latestBatch?.status === 'failed' && (
            <Button
              type="link"
              onClick={() => {
                void automation.retryBatch(record.latestBatch!.id).catch((error) => {
                  message.error(error instanceof Error ? error.message : '复跑任务失败');
                });
              }}
            >
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
