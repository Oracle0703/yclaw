import { Button, Card, Descriptions, Tag, Typography, message } from 'antd';
import type { InterventionState } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';
import { useIpc } from '../../../shared/hooks';

interface InterventionPanelProps {
  state: InterventionState | null;
}

export function InterventionPanel({ state }: InterventionPanelProps) {
  const { invoke } = useIpc();

  if (!state) {
    return (
      <Card className="yclaw-panel-card" title="介入台">
        <Typography.Text type="secondary">当前没有需要人工介入的任务。</Typography.Text>
      </Card>
    );
  }

  return (
    <Card className="yclaw-panel-card" title="介入台" extra={<Tag color="warning">{state.flowRunnerStatus}</Tag>}>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="任务">{state.taskId}</Descriptions.Item>
        <Descriptions.Item label="批次">{state.batchId}</Descriptions.Item>
        <Descriptions.Item label="会话">{state.sessionPartition}</Descriptions.Item>
        <Descriptions.Item label="错误">
          {state.breakpoint?.error ?? '无'}
        </Descriptions.Item>
      </Descriptions>

      <Button
        type="primary"
        style={{ marginTop: 16 }}
        onClick={() => {
          void invoke(IPC_CHANNELS.INTERVENTION_RESUME, {
            taskId: state.taskId,
            batchId: state.batchId,
          }).catch((error) => {
            message.error(error instanceof Error ? error.message : '恢复自动执行失败');
          });
        }}
        >
        恢复自动执行
      </Button>
    </Card>
  );
}
