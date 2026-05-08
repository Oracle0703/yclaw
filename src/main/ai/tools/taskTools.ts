/**
 * 内置 AI 工具 — 任务相关
 */

import type { AITool } from '../types';
import type { TaskRepository } from '../../services/repositories';
import type { TaskState } from '../../services/TaskService';

export function createTaskListTool(
  taskRepository: Pick<TaskRepository, 'getTasks'>,
): AITool {
  return {
    name: 'task_list',
    description: '列出所有自动化任务及其状态',
    parameters: {},
    confirmationLevel: 0,
    async execute() {
      try {
        const tasks = taskRepository.getTasks();
        const summary = {
          total: tasks.length,
          success: tasks.filter((t) => t.status === 'completed' || t.status === 'idle').length,
          failed: tasks.filter((t) => t.status === 'failed').length,
          running: tasks.filter((t) => t.status === 'running').length,
          partial: tasks.filter((t) => t.status === 'partial').length,
        };
        return {
          success: true,
          data: { tasks, summary },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch tasks',
        };
      }
    },
  };
}

export function createTaskStartTool(
  taskRepository: Pick<TaskRepository, 'getTasks'>,
  startTask: (taskId: string) => TaskState,
): AITool {
  return {
    name: 'task_start',
    description: '启动一个自动化任务',
    parameters: {
      taskId: { type: 'string', description: '任务 ID，优先使用' },
      taskName: { type: 'string', description: '任务名称，可模糊匹配' },
    },
    confirmationLevel: 2,
    async execute(params) {
      try {
        const tasks = taskRepository.getTasks();
        const requestedTaskId = typeof params.taskId === 'string' ? params.taskId.trim() : '';
        const requestedTaskName = typeof params.taskName === 'string' ? params.taskName.trim() : '';

        if (!requestedTaskId && !requestedTaskName) {
          return { success: false, error: '请提供 taskId 或 taskName 来启动任务' };
        }

        const taskById = requestedTaskId
          ? tasks.find((task) => task.id === requestedTaskId)
          : undefined;
        if (requestedTaskId && !taskById) {
          return { success: false, error: `Task "${requestedTaskId}" not found` };
        }

        let task = taskById;
        if (!task && requestedTaskName) {
          const exactMatch = tasks.find((candidate) => candidate.name === requestedTaskName);
          if (exactMatch) {
            task = exactMatch;
          } else {
            const fuzzyMatches = tasks.filter((candidate) => candidate.name.includes(requestedTaskName));
            if (fuzzyMatches.length === 1) {
              task = fuzzyMatches[0];
            } else if (fuzzyMatches.length > 1) {
              return {
                success: false,
                error: `找到多个匹配任务：${fuzzyMatches.map((candidate) => candidate.name).join('、')}`,
              };
            }
          }
        }

        if (!task) {
          return { success: false, error: `Task "${requestedTaskName || requestedTaskId}" not found` };
        }

        const state = startTask(task.id);
        return {
          success: true,
          data: {
            taskId: task.id,
            taskName: task.name,
            status: state.status,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start task',
        };
      }
    },
  };
}
