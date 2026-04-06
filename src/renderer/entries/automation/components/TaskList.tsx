import React, { useEffect, useState } from 'react';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { TaskFlow, TaskStatus } from '@shared/types';

interface TaskSummary {
  id: string;
  name: string;
  status: TaskStatus;
  stepsCount: number;
  updatedAt: string;
}

export function TaskList({ onSelect }: { onSelect: (id: string) => void }) {
  const { invoke } = useIpc();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    const res = await invoke<TaskSummary[]>(IPC_CHANNELS.TASK_LIST);
    if (res.success && res.data) setTasks(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useIpcEvent('task:statusChanged', fetchTasks);

  if (loading) return <div className="task-list-loading">加载中...</div>;

  return (
    <div className="task-list">
      <div className="task-list-header">
        <h3>任务列表</h3>
        <button onClick={() => onSelect('new')}>+ 新建任务</button>
      </div>
      {tasks.length === 0 ? (
        <div className="task-list-empty">暂无任务，点击上方按钮创建</div>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id} className={`task-item task-${task.status}`} onClick={() => onSelect(task.id)}>
              <span className="task-name">{task.name}</span>
              <span className="task-meta">
                {task.stepsCount} 步 · {task.status}
              </span>
              <span className="task-time">{task.updatedAt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
