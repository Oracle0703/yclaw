import React from 'react';
import { useIpc, useIpcEvent } from '../../../shared/hooks';
import { IPC_CHANNELS } from '@shared/constants/channels';

interface ExecutionPanelProps {
  taskId: string | null;
  status: string;
  currentStep: number;
  totalSteps: number;
  logs: string[];
  hasBreakpoint: boolean;
}

export function ExecutionPanel({
  taskId,
  status,
  currentStep,
  totalSteps,
  logs,
  hasBreakpoint,
}: ExecutionPanelProps) {
  const { invoke } = useIpc();

  const handleStart = () => {
    if (taskId) invoke(IPC_CHANNELS.TASK_START, { taskId });
  };
  const handlePause = () => {
    if (taskId) invoke(IPC_CHANNELS.TASK_PAUSE, { taskId });
  };
  const handleResume = () => {
    if (taskId) invoke(IPC_CHANNELS.TASK_RESUME, { taskId });
  };
  const handleStop = () => {
    if (taskId) invoke(IPC_CHANNELS.TASK_STOP, { taskId });
  };

  return (
    <div className="execution-panel">
      <div className="exec-header">
        <h3>执行面板</h3>
        <div className="exec-status">状态: {status}</div>
      </div>

      <div className="exec-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: totalSteps > 0 ? `${(currentStep / totalSteps) * 100}%` : '0%' }}
          />
        </div>
        <span className="progress-text">
          {currentStep} / {totalSteps}
        </span>
      </div>

      <div className="exec-controls">
        <button onClick={handleStart} disabled={status === 'running'}>
          ▶ 启动
        </button>
        <button onClick={handlePause} disabled={status !== 'running'}>
          ⏸ 暂停
        </button>
        <button onClick={handleResume} disabled={status !== 'paused'}>
          ⏯ 继续
        </button>
        <button onClick={handleStop} disabled={status === 'idle'}>
          ⏹ 停止
        </button>
        {hasBreakpoint && (
          <button onClick={handleResume} className="breakpoint-resume-btn">
            🔄 从断点继续
          </button>
        )}
      </div>

      <div className="exec-logs">
        <h4>执行日志</h4>
        <div className="log-container">
          {logs.map((log, i) => (
            <div key={i} className="log-line">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
