import { useState } from 'react';
import { Button, List, Space, Tag, Typography, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants';
import { useIpc } from '../../../shared/hooks';
import type { TaskStep } from '@shared/types';

interface RecorderPanelProps {
  tabId: number | null;
  onRecorded?: (steps: TaskStep[]) => void;
}

export function RecorderPanel({ tabId, onRecorded }: RecorderPanelProps) {
  const { invoke } = useIpc();
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([]);

  const handleStart = async () => {
    if (tabId == null || pending || recording) {
      return;
    }

    setPending(true);
    try {
      await invoke(IPC_CHANNELS.RECORDER_START, { tabId });
      setRecording(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动录制失败');
    } finally {
      setPending(false);
    }
  };

  const handleStop = async () => {
    if (tabId == null || pending || !recording) {
      return;
    }

    setPending(true);
    try {
      const nextSteps = await invoke<TaskStep[]>(IPC_CHANNELS.RECORDER_STOP, { tabId });
      setRecording(false);
      setSteps(nextSteps ?? []);
      onRecorded?.(nextSteps ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '停止录制失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <ProCard
      className="yclaw-panel-card"
      title="录制器"
      extra={<Tag color={recording ? 'processing' : 'default'}>{recording ? '录制中' : '待机'}</Tag>}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space wrap>
          <Button
            type="primary"
            onClick={() => void handleStart()}
            disabled={tabId == null || recording || pending}
          >
            开始录制
          </Button>
          <Button onClick={() => void handleStop()} disabled={tabId == null || !recording || pending}>
            停止录制
          </Button>
        </Space>

        <Typography.Text type="secondary">
          录制结束后会在这里展示步骤预览，可直接导入自动化编辑器。
        </Typography.Text>

        <List
          bordered
          dataSource={steps}
          locale={{ emptyText: '暂无录制步骤' }}
          renderItem={(step) => (
            <List.Item>
              <Space>
                <Tag>{step.action.type}</Tag>
                <Typography.Text>{step.name}</Typography.Text>
                <Typography.Text type="secondary">{step.action.selector}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Space>
    </ProCard>
  );
}
