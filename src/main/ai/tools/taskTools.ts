/**
 * 内置 AI 工具 — 任务相关
 */

import type { AITool } from '../types';

import { DatabaseService } from '../../services/DatabaseService';

export const taskListTool: AITool = {
  name: 'task_list',
  description: '列出所有自动化任务及其状态',
  parameters: {},
  confirmationLevel: 0,
  async execute() {
    try {
      const db = DatabaseService.getInstance();
      const tasks = db.getTasks();
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
