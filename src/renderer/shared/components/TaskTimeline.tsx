import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Timeline, Typography } from 'antd';

export type TimelineStatus = 'success' | 'failed' | 'running' | 'pending' | 'partial';

export interface TimelineItem {
  id: string;
  name: string;
  time: string;
  status: TimelineStatus;
  module?: string;
}

export interface TaskTimelineProps {
  items: TimelineItem[];
  onItemClick?: (item: TimelineItem) => void;
}

const STATUS_CONFIG: Record<
  TimelineStatus,
  { color: string; icon: React.ReactNode; label: string }
> = {
  success: {
    color: '#52c41a',
    icon: <CheckCircleOutlined />,
    label: '成功',
  },
  failed: {
    color: '#ff4d4f',
    icon: <CloseCircleOutlined />,
    label: '失败',
  },
  running: {
    color: '#1677ff',
    icon: <LoadingOutlined />,
    label: '进行中',
  },
  pending: {
    color: '#d9d9d9',
    icon: <ClockCircleOutlined />,
    label: '待执行',
  },
  partial: {
    color: '#faad14',
    icon: <WarningOutlined />,
    label: '部分失败',
  },
};

export default function TaskTimeline({ items, onItemClick }: TaskTimelineProps) {
  return (
    <Timeline
      data-testid="task-timeline"
      items={items.map((item) => {
        const config = STATUS_CONFIG[item.status];
        return {
          color: config.color,
          dot: config.icon,
          children: (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <Typography.Text strong>{item.time}</Typography.Text>
                <Typography.Text style={{ marginLeft: 8 }}>{item.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {config.label}
                </Typography.Text>
              </div>
              {onItemClick && (
                <Button type="link" size="small" onClick={() => onItemClick(item)}>
                  查看
                </Button>
              )}
            </div>
          ),
        };
      })}
    />
  );
}
