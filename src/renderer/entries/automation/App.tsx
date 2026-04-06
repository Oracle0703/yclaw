import React, { useState, useCallback } from 'react';
import { TaskList } from './components/TaskList';
import { StepEditor } from './components/StepEditor';
import { ExecutionPanel } from './components/ExecutionPanel';
import { useIpcEvent } from '../../shared/hooks';
import type { TaskStep } from '@shared/types';
import '../../shared/styles/globals.css';

type View = 'list' | 'editor' | 'execution';

export default function App() {
  const [view, setView] = useState<View>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [execStatus, setExecStatus] = useState('idle');
  const [execStep, setExecStep] = useState(0);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [hasBreakpoint, setHasBreakpoint] = useState(false);

  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskId(id === 'new' ? null : id);
    setView('editor');
  }, []);

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
    <div className="app automation-app">
      <nav className="automation-nav">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          任务列表
        </button>
        <button className={view === 'editor' ? 'active' : ''} onClick={() => setView('editor')}>
          编辑器
        </button>
        <button className={view === 'execution' ? 'active' : ''} onClick={() => setView('execution')}>
          执行面板
        </button>
      </nav>

      <main className="automation-content">
        {view === 'list' && <TaskList onSelect={handleSelectTask} />}
        {view === 'editor' && <StepEditor steps={steps} onChange={setSteps} />}
        {view === 'execution' && (
          <ExecutionPanel
            taskId={selectedTaskId}
            status={execStatus}
            currentStep={execStep}
            totalSteps={steps.length}
            logs={execLogs}
            hasBreakpoint={hasBreakpoint}
          />
        )}
      </main>
    </div>
  );
}
