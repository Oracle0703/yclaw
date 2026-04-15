import { useState } from 'react';
import { Button, Input, Space, Tag } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { EVENTS, IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import type { TaskFlow, TaskStep } from '@shared/types';
import { ExecutionPanel } from './components/ExecutionPanel';
import { StepEditor } from './components/StepEditor';
import { TaskList } from './components/TaskList';

interface SelectedTaskSummary {
  id: string;
  stepsCount?: number;
}

export default function App() {
  const { invoke } = useIpc();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskSummary, setSelectedTaskSummary] = useState<SelectedTaskSummary | null>(null);
  const [taskName, setTaskName] = useState('');
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [execStatus, setExecStatus] = useState('idle');
  const [execStep, setExecStep] = useState(0);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [hasBreakpoint, setHasBreakpoint] = useState(false);
  const [showExecution, setShowExecution] = useState(false);

  const handleSelectTask = async (task: SelectedTaskSummary | 'new') => {
    if (task === 'new') {
      setSelectedTaskId(null);
      setSelectedTaskSummary(null);
      setTaskName('');
      setSteps([]);
      return;
    }

    setSelectedTaskId(task.id);
    setSelectedTaskSummary(task);

    try {
      const flow = await invoke<TaskFlow>(IPC_CHANNELS.TASK_GET, { taskId: task.id });
      setTaskName(flow.name);
      setSteps(flow.steps);
    } catch {
      setTaskName('');
      setSteps([]);
    }
  };

  const handleSaveTask = async () => {
    const saved = await invoke<TaskFlow>(IPC_CHANNELS.TASK_SAVE, {
      taskId: selectedTaskId,
      name: taskName,
      steps,
    });

    setSelectedTaskId(saved.id);
    setSelectedTaskSummary({
      id: saved.id,
      stepsCount: saved.steps.length,
    });
    setTaskName(saved.name);
    setSteps(saved.steps);
  };

  const totalSteps = steps.length > 0 ? steps.length : (selectedTaskSummary?.stepsCount ?? 0);

  useIpcEvent(EVENTS.TASK_STARTED, (_data: unknown) => {
    const data = _data as { flowId?: string };
    if (data.flowId && selectedTaskId && data.flowId !== selectedTaskId) {
      return;
    }
    setExecStatus('running');
    setHasBreakpoint(false);
    setExecStep(0);
    setShowExecution(true);
    setExecLogs((prev) => [...prev, '任务开始执行']);
  });

  useIpcEvent(EVENTS.TASK_STEP_COMPLETED, (_data: unknown) => {
    const data = _data as { stepIndex: number };
    setExecStep(data.stepIndex + 1);
    setExecLogs((prev) => [...prev, `步骤 ${data.stepIndex + 1} 完成`]);
  });

  useIpcEvent(EVENTS.TASK_COMPLETED, () => {
    setExecStatus('completed');
    setHasBreakpoint(false);
    setExecLogs((prev) => [...prev, '任务执行完成']);
  });

  useIpcEvent(EVENTS.TASK_PAUSED, () => {
    setExecStatus('paused');
    setExecLogs((prev) => [...prev, '任务已暂停']);
  });

  useIpcEvent(EVENTS.TASK_FAILED, (_data: unknown) => {
    const data = _data as { error: string };
    setExecStatus('failed');
    setHasBreakpoint(true);
    setExecLogs((prev) => [...prev, `❌ 失败: ${data.error}`]);
  });

  return (
    <PageShell
      title="自动化采集"
      subTitle="统一编排任务流、步骤配置和执行状态"
      content="将 RPA 任务资产、编辑器和执行日志集中在一个中台页面内，便于团队协作和巡检。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Automation</Tag>
          <Input
            aria-label="任务名称"
            placeholder="请输入任务名称"
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            style={{ width: 220 }}
          />
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedTaskId(null);
              setSelectedTaskSummary(null);
              setTaskName('');
              setSteps([]);
            }}
          >
            新建任务
          </Button>
          <Button onClick={() => void handleSaveTask()} disabled={steps.length === 0}>
            保存任务
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => setShowExecution((v) => !v)}
          >
            {showExecution ? '隐藏执行面板' : '打开执行面板'}
          </Button>
        </Space>
      }
    >
      <div className="yclaw-automation-split">
        {/* 左栏：任务列表 */}
        <div className="yclaw-automation-sidebar">
          <TaskList onSelect={handleSelectTask} />
        </div>

        {/* 右栏：编辑器 + 执行面板 */}
        <div className="yclaw-automation-main">
          <ProCard className="yclaw-panel-card" title="步骤编辑器" style={{ flex: 1 }}>
            <StepEditor steps={steps} onChange={setSteps} />
          </ProCard>

          {showExecution && (
            <ProCard className="yclaw-panel-card" title="执行面板" style={{ flex: 'none' }}>
              <ExecutionPanel
                taskId={selectedTaskId}
                status={execStatus}
                currentStep={execStep}
                totalSteps={totalSteps}
                logs={execLogs}
                hasBreakpoint={hasBreakpoint}
                onStatusChange={setExecStatus}
                onError={(message) => {
                  setExecStatus('failed');
                  setExecLogs((prev) => [...prev, `❌ ${message}`]);
                }}
                onStopped={() => {
                  setHasBreakpoint(false);
                  setExecStep(0);
                  setExecStatus('idle');
                  setExecLogs((prev) => [...prev, '任务已停止']);
                }}
              />
            </ProCard>
          )}
        </div>
      </div>
    </PageShell>
  );
}
