import { Button, Drawer, List, Space, Tag } from 'antd';
import type { RemoteExecution, RemoteExecutionLog } from '@shared/types';

export interface RemoteExecutionDrawerProps {
  open: boolean;
  runnerConnectionId: string;
  execution: RemoteExecution | null;
  logs: RemoteExecutionLog[];
  onRefresh: () => Promise<void> | void;
  onCancel: (executionId: string, runnerConnectionId: string) => Promise<void> | void;
  onClose: () => void;
}

export function RemoteExecutionDrawer(props: RemoteExecutionDrawerProps) {
  const { open, runnerConnectionId, execution, logs, onRefresh, onCancel, onClose } = props;

  return (
    <Drawer open={open} title="远程执行详情" onClose={onClose}>
      {execution ? (
        <Space>
          <strong>{execution.id}</strong>
          <Tag>{execution.status}</Tag>
          <span>{execution.currentStepId ?? 'no-step'}</span>
          <span>重试:{execution.retryCount}</span>
          <Button onClick={() => void onRefresh()}>刷新</Button>
          <Button onClick={() => void onCancel(execution.id, runnerConnectionId)}>取消执行</Button>
        </Space>
      ) : null}
      <List
        dataSource={logs}
        renderItem={(log) => (
          <div>
            <Space>
              <span>{log.level}</span>
              <span>{log.message}</span>
            </Space>
          </div>
        )}
      />
    </Drawer>
  );
}
