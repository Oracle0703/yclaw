import { useState } from 'react';
import { Button, Space, Tabs, Tag } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import { useIpcEvent } from '../../shared/hooks';
import type { TaskStep } from '@shared/types';
import { ExecutionPanel } from './components/ExecutionPanel';
import { StepEditor } from './components/StepEditor';
import { TaskList } from './components/TaskList';

type View = 'list' | 'editor' | 'execution';

export default function App() {
  const [view, setView] = useState<View>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [execStatus, setExecStatus] = useState('idle');
  const [execStep, setExecStep] = useState(0);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [hasBreakpoint, setHasBreakpoint] = useState(false);

  const handleSelectTask = (id: string) => {
    setSelectedTaskId(id === 'new' ? null : id);
    setView('editor');
  };

  useIpcEvent('task:stepCompleted', (_data: unknown) => {
    const data = _data as { stepIndex: number };
    setExecStep(data.stepIndex + 1);
    setExecLogs((prev) => [...prev, `步骤 ${data.stepIndex + 1} 完成`]);
  });

  useIpcEvent('task:failed', (_data: unknown) => {
    const data = _data as { error: string };
    setExecStatus('failed');
    setHasBreakpoint(true);
    setExecLogs((prev) => [...prev, `❌ 失败: ${data.error}`]);
  });

  return (
    <AdminPageLayout
      currentPath="/automation"
      title="自动化采集"
      subTitle="统一编排任务流、步骤配置和执行状态"
      content="将 RPA 任务资产、编辑器和执行日志集中在一个中台页面内，便于团队协作和巡检。"
      extra={
        <Space>
          <Tag color="purple">RPA Console</Tag>
          <Button icon={<PlusOutlined />} onClick={() => setView('editor')}>
            新建任务
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setView('execution')}>
            打开执行面板
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={view}
        onChange={(key) => setView(key as View)}
        items={[
          {
            key: 'list',
            label: '任务列表',
            children: <TaskList onSelect={handleSelectTask} />,
          },
          {
            key: 'editor',
            label: '步骤编辑器',
            children: <StepEditor steps={steps} onChange={setSteps} />,
          },
          {
            key: 'execution',
            label: '执行面板',
            children: (
              <ExecutionPanel
                taskId={selectedTaskId}
                status={execStatus}
                currentStep={execStep}
                totalSteps={steps.length}
                logs={execLogs}
                hasBreakpoint={hasBreakpoint}
              />
            ),
          },
        ]}
      />
    </AdminPageLayout>
  );
}
