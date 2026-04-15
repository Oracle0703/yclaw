import { useCallback, useEffect, useState } from 'react';
import { Button, List, Progress, Space, Tag, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { useIpc } from '../../../shared/hooks';
import type { AlertRecord } from '@shared/types';

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
  onJumpToBatch?: (batchId: string) => void;
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
  onJumpToBatch,
}: ExecutionPanelProps) {
  const { invoke } = useIpc();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!taskId) {
      setAlerts([]);
      return;
    }

    setLoadingAlerts(true);
    try {
      const result = await invoke<AlertRecord[]>(IPC_CHANNELS.ALERT_LIST, { taskId });
      setAlerts(result ?? []);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '加载告警失败');
    } finally {
      setLoadingAlerts(false);
    }
  }, [invoke, onError, taskId]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

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

  const handleDismissAlert = async (alertId: string) => {
    try {
      await invoke(IPC_CHANNELS.ALERT_DISMISS, { alertId });
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? { ...alert, read: true } : alert)),
      );
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '告警标记失败');
    }
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

        <div>
          <Typography.Title level={5}>最近告警</Typography.Title>
          <List
            bordered
            loading={loadingAlerts}
            dataSource={alerts}
            locale={{ emptyText: '暂无告警' }}
            renderItem={(alert) => (
              <List.Item
                actions={[
                  alert.batchId ? (
                    <Button key="jump" type="link" onClick={() => onJumpToBatch?.(alert.batchId!)}>
                      跳转到批次
                    </Button>
                  ) : null,
                  <Button
                    key="dismiss"
                    type="link"
                    onClick={() => void handleDismissAlert(alert.id)}
                    disabled={alert.read}
                  >
                    标记已读
                  </Button>,
                ].filter(Boolean)}
              >
                <Space direction="vertical" size={4}>
                  <Space>
                    <Tag color={alert.read ? 'default' : 'error'}>{alert.read ? '已读' : '未读'}</Tag>
                    {alert.batchId && <Typography.Text type="secondary">{alert.batchId}</Typography.Text>}
                  </Space>
                  <Typography.Text>{alert.message}</Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </ProCard>
  );
}
