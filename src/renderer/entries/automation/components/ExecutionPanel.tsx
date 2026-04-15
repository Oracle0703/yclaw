import { Button, List, Progress, Space, Tag, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { useIpc } from '../../../shared/hooks';

interface ExecutionPanelProps {
  taskId: string | null;
  status: string;
  currentStep: number;
  totalSteps: number;
  logs: string[];
  hasBreakpoint: boolean;
  onStatusChange?: (status: string) => void;
  onError?: (message: string) => void;
  onStopped?: () => void;
}

export function ExecutionPanel({
  taskId,
  status,
  currentStep,
  totalSteps,
  logs,
  hasBreakpoint,
  onStatusChange,
  onError,
  onStopped,
}: ExecutionPanelProps) {
  const { invoke } = useIpc();

  const invokeTask = async (
    channel: string,
    nextStatus: string,
    options: { stopped?: boolean } = {},
  ) => {
    if (!taskId) return;

    try {
      const result = await invoke<{ status?: string }>(channel, { taskId });
      if (options.stopped) {
        onStopped?.();
        return;
      }
      onStatusChange?.(result?.status ?? nextStatus);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '任务操作失败');
    }
  };

  const handleStart = () => {
    void invokeTask(IPC_CHANNELS.TASK_START, 'running');
  };
  const handlePause = () => {
    void invokeTask(IPC_CHANNELS.TASK_PAUSE, 'paused');
  };
  const handleResume = () => {
    void invokeTask(IPC_CHANNELS.TASK_RESUME, 'running');
  };
  const handleStop = () => {
    void invokeTask(IPC_CHANNELS.TASK_STOP, 'idle', { stopped: true });
  };

  return (
    <ProCard
      className="yclaw-panel-card"
      title="执行面板"
      extra={<Tag color={status === 'running' ? 'processing' : status === 'failed' ? 'error' : 'default'}>状态: {status}</Tag>}
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary">当前进度</Typography.Text>
          <Progress percent={totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0} />
          <Typography.Text>{currentStep} / {totalSteps}</Typography.Text>
        </div>

        <Space wrap>
          <Button onClick={handleStart} disabled={status === 'running'} type="primary">
            启动
          </Button>
          <Button onClick={handlePause} disabled={status !== 'running'}>
            暂停
          </Button>
          <Button onClick={handleResume} disabled={status !== 'paused'}>
            继续
          </Button>
          <Button onClick={handleStop} disabled={status === 'idle'} danger>
            停止
          </Button>
          {hasBreakpoint && (
            <Button onClick={handleResume}>从断点继续</Button>
          )}
        </Space>

        <div>
          <Typography.Title level={5}>执行日志</Typography.Title>
          <List
            bordered
            dataSource={logs}
            locale={{ emptyText: '暂无执行日志' }}
            renderItem={(log) => <List.Item>{log}</List.Item>}
          />
        </div>
      </Space>
    </ProCard>
  );
}
